"""Create the evidence branch only with --publish <full final candidate SHA>."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = Path.cwd().resolve()
CACHE = ROOT / '.cache/rebase251'
BASE = '581f30cfaa32b01399422b087b0f0bdc3b800f70'
BRANCH = 'codex/s2-5-01a-rebase-evidence'
PREFIX = 'review-evidence/s2-5-01a-rebase'


def read_json(path):
    return json.loads(path.read_text())


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def main():
    meta = read_json(CACHE / 'publish-metadata.json')
    head = meta['candidate']
    assert sys.argv[1:] == ['--publish', head], 'Explicit --publish <full final candidate SHA> required.'
    assert re.fullmatch(r'[a-f0-9]{40}', head) and meta['mergeBase'] == BASE, 'Invalid candidate/base pins.'
    assert meta['branch'] == BRANCH and meta['prefix'] == PREFIX, 'Unexpected evidence destination.'
    assert git('rev-parse', 'HEAD') == head and not git('status', '--porcelain'), 'Candidate must remain clean.'
    assert git('rev-parse', 'origin/main') == BASE and git('merge-base', BASE, head) == BASE, 'Base moved.'
    checker = read_json(ROOT / 'ast-report/pr-review.json')
    assert checker['candidate'] == head and checker['mergeBase'] == BASE, 'Stale checker.'
    stage = CACHE / 'publish' / PREFIX / head
    assert str(stage) == meta['stage'] and stage.resolve() == stage, 'Unsafe stage.'
    scan = read_json(stage / 'secret-scan.json')
    assert scan['candidate'] == head and scan['mergeBase'] == BASE, 'Stale scan pins.'
    assert not scan['matchedFiles'] and scan['configuredSecretValuesChecked'] >= 1, 'Successful configured-secret scan required.'
    assert scan['requiredSecretSources'] == ['WORKOS_API_KEY', 'AXIOM_API_KEY'], 'Both exact configured sources required.'
    entries = list(stage.rglob('*'))
    assert not any(path.is_symlink() for path in entries), 'Symlinks excluded.'
    files = sorted(path for path in entries if path.is_file() and path.relative_to(stage).as_posix() not in ['secret-scan.json', 'manifest.json'])
    hashes = {path.relative_to(stage).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    assert hashes and hashes == scan['files'], 'Stage changed after scan.'
    assert read_json(stage / 'final-binding.json')['evidenceComplete'] is True, 'Final inventory sign-off required.'
    manager = read_json(stage / 'review/manager-review-final.json')
    assert manager['candidate'] == head and manager['mergeBase'] == BASE and manager['reviewed'] is True, 'Manager review missing.'
    assert not git('ls-remote', '--heads', 'origin', BRANCH), 'Evidence branch exists; do not overwrite it.'
    manifest = {'candidate': head, 'mergeBase': BASE, 'files': {**hashes, 'secret-scan.json': hashlib.sha256((stage / 'secret-scan.json').read_bytes()).hexdigest()}}
    (stage / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    files = sorted(path for path in stage.rglob('*') if path.is_file())
    descriptor, index = tempfile.mkstemp(prefix='rebase251-evidence-index-')
    os.close(descriptor)
    os.unlink(index)
    env = {**os.environ, 'GIT_INDEX_FILE': index}
    def isolated_git(*args, input=None):
        return subprocess.check_output(['git', *args], input=input, env=env)
    try:
        isolated_git('read-tree', '--empty')
        prefix = f'{PREFIX}/{head}/'
        records = []
        for path in files:
            name = prefix + path.relative_to(stage).as_posix()
            assert not any(char in name for char in '\n\t\0'), 'Unsafe Git path.'
            oid = isolated_git('hash-object', '-w', '--stdin', input=path.read_bytes()).decode().strip()
            records.append(f'100644 {oid}\t{name}\0'.encode())
        isolated_git('update-index', '-z', '--index-info', input=b''.join(records))
        tree = isolated_git('write-tree').decode().strip()
        assert isolated_git('ls-tree', '-r', '--name-only', tree).decode().splitlines() == sorted(prefix + path.relative_to(stage).as_posix() for path in files), 'Unexpected tree entries.'
        assert git('rev-parse', 'HEAD') == head and not git('status', '--porcelain'), 'Candidate changed before push.'
        commit = isolated_git('commit-tree', tree, input=f'Preserve PR 251 rebase evidence for {head}\n'.encode()).decode().strip()
        # Empty expected remote SHA permits creation only, including a push race.
        subprocess.run(['git', 'push', f'--force-with-lease=refs/heads/{BRANCH}:', 'origin', f'{commit}:refs/heads/{BRANCH}'], check=True)
        meta.update(evidenceCommit=commit, evidenceBranch=BRANCH, fileCount=len(files), url=f'https://github.com/tomer-mayara/Thermus/tree/{commit}/{PREFIX}/{head}')
        (CACHE / 'publish-metadata.json').write_text(json.dumps(meta, indent=2) + '\n')
        print(json.dumps({key: meta[key] for key in ['candidate', 'evidenceCommit', 'evidenceBranch', 'fileCount', 'url']}))
    finally:
        Path(index).unlink(missing_ok=True)


if __name__ == '__main__':
    main()
