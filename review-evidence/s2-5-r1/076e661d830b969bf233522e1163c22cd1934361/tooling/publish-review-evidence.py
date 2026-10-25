"""Publish an exact scanned R1 stage only with --publish <full candidate SHA>."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = Path.cwd().resolve()
CACHE = ROOT / '.cache/s25-r1'
BRANCH = 'codex/s2-5-r1-review-evidence'
PARENT_REF = 'origin/codex/s2-5-02-removal-verification'

def read_json(path):
    return json.loads(path.read_text())

def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()

def main():
    meta = read_json(CACHE / 'publish-metadata.json')
    assert sys.argv[1:] == ['--publish', meta['candidate']], 'Explicit --publish <full candidate SHA> required.'
    assert re.fullmatch(r'[0-9a-f]{40}', meta['candidate']), 'Invalid candidate.'
    assert git('rev-parse', 'HEAD') == meta['candidate'] and not git('status', '--porcelain'), 'Candidate must be clean and unchanged.'
    assert git('rev-parse', PARENT_REF) == meta['parentTip'], 'Parent tip changed; refresh evidence.'
    assert git('merge-base', PARENT_REF, meta['candidate']) == meta['parentMergeBase'], 'Parent base changed.'
    checker = read_json(ROOT / 'ast-report/pr-review.json')
    assert checker['candidate'] == meta['candidate'] and checker['mergeBase'] == meta['parentMergeBase'], 'Stale checker.'
    stage = CACHE / 'publish/review-evidence/s2-5-r1' / meta['candidate']
    assert str(stage) == meta['stage'] and stage.resolve() == stage, 'Unsafe stage path.'
    scan = read_json(stage / 'secret-scan.json')
    assert scan['candidate'] == meta['candidate'] and scan['parentMergeBase'] == meta['parentMergeBase'], 'Stale scan pins.'
    assert not scan['matchedFiles'] and scan['configuredSecretValuesChecked'] >= 2, 'Successful exact configured-secret scan required.'
    assert scan['requiredSecretSources'] == ['WORKOS_API_KEY', 'AXIOM_API_KEY'], 'Required secret sources not scanned.'
    entries = list(stage.rglob('*'))
    assert not any(path.is_symlink() for path in entries), 'Symlinks excluded.'
    files = sorted(path for path in entries if path.is_file() and path.relative_to(stage).as_posix() not in ['secret-scan.json','manifest.json'])
    hashes = {path.relative_to(stage).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    assert hashes and hashes == scan['files'], 'Stage changed after the exact scan.'
    assert not any(re.search(r'user[-_ ]?draft|production-cutover|credential|(^|/)\.env|raw[-_]?v8', name, re.I) for name in hashes), 'Excluded file found.'
    assert read_json(stage / 'final-binding.json')['evidenceComplete'] is True
    # No overwrite or force push, and no local branch or checkout/index change.
    assert not git('ls-remote', '--heads', 'origin', BRANCH), 'Evidence branch exists; inspect it before any update.'
    manifest = {'candidate': meta['candidate'], 'parentMergeBase': meta['parentMergeBase'], 'files': {**hashes, 'secret-scan.json': hashlib.sha256((stage / 'secret-scan.json').read_bytes()).hexdigest()}}
    (stage / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    files = sorted(path for path in stage.rglob('*') if path.is_file())
    fd, index = tempfile.mkstemp(prefix='s25-r1-evidence-index-')
    os.close(fd)
    os.unlink(index)
    env = {**os.environ, 'GIT_INDEX_FILE': index}
    def isolated_git(*args, input=None):
        return subprocess.check_output(['git', *args], input=input, env=env)
    try:
        isolated_git('read-tree', '--empty')
        records = []
        prefix = 'review-evidence/s2-5-r1/' + meta['candidate'] + '/'
        for path in files:
            oid = isolated_git('hash-object', '-w', '--stdin', input=path.read_bytes()).decode().strip()
            name = prefix + path.relative_to(stage).as_posix()
            assert '\n' not in name and '\t' not in name and '\0' not in name, 'Unsafe Git path.'
            records.append(f'100644 {oid}\t{name}\0'.encode())
        isolated_git('update-index', '-z', '--index-info', input=b''.join(records))
        tree = isolated_git('write-tree').decode().strip()
        staged_names = isolated_git('ls-tree', '-r', '--name-only', tree).decode().splitlines()
        assert staged_names == sorted(prefix + path.relative_to(stage).as_posix() for path in files), 'Unexpected evidence tree file.'
        assert git('rev-parse', 'HEAD') == meta['candidate'] and not git('status', '--porcelain'), 'Candidate changed before publication.'
        commit = isolated_git('commit-tree', tree, input=f"Preserve S2.5-R1 evidence for {meta['candidate']}\n".encode()).decode().strip()
        # The empty expected remote SHA makes this a create-only, race-safe push.
        subprocess.run(['git', 'push', f'--force-with-lease=refs/heads/{BRANCH}:', 'origin', f'{commit}:refs/heads/{BRANCH}'], check=True)
        meta.update(evidenceCommit=commit, evidenceBranch=BRANCH, fileCount=len(files), url=f"https://github.com/tomer-mayara/Thermus/tree/{commit}/review-evidence/s2-5-r1/{meta['candidate']}")
        (CACHE / 'publish-metadata.json').write_text(json.dumps(meta, indent=2) + '\n')
        print(json.dumps({key: meta[key] for key in ['candidate','evidenceCommit','evidenceBranch','fileCount','url']}))
    finally:
        Path(index).unlink(missing_ok=True)

if __name__ == '__main__':
    main()
