"""Create the evidence branch once. Never change the checkout or its index."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = Path.cwd().resolve()
PUBLICATION = ROOT / '.cache/pr251-rebase-8c6d204e/publication'
BASE = '8c6d204e8588a664438ba8934ab36670b802525f'
BRANCH = 'codex/pr251-rebase-8c6d204e-evidence'
PREFIX = 'review-evidence/pr251-rebase-8c6d204e'


def load(path):
    return json.loads(path.read_text())


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    metadata = load(PUBLICATION / 'metadata.json')
    head = metadata['candidate']
    assert sys.argv[1:] == ['--publish', head] and re.fullmatch(r'[a-f0-9]{40}', head), 'Use --publish <full final candidate SHA>.'
    assert metadata['mergeBase'] == BASE and metadata['branch'] == BRANCH and metadata['prefix'] == PREFIX, 'Unexpected publication destination.'
    assert git('rev-parse', 'HEAD') == head and not git('status', '--porcelain'), 'Current candidate must remain committed and clean.'
    assert git('rev-parse', 'origin/main') == BASE and git('merge-base', BASE, head) == BASE, 'Pinned base changed.'
    checker = load(ROOT / 'ast-report/pr-review.json')
    assert checker['candidate'] == head and checker['mergeBase'] == BASE, 'Stale checker.'
    stage = PUBLICATION / 'stage' / PREFIX / head
    assert metadata['stage'] == str(stage) and stage.resolve() == stage, 'Unexpected stage.'
    entries = list(stage.rglob('*'))
    assert not any(path.is_symlink() for path in entries), 'Symlinks are excluded.'
    files = sorted(path for path in entries if path.is_file() and path.name not in ['secret-scan.json', 'manifest.json'])
    hashes = {path.relative_to(stage).as_posix(): digest(path) for path in files}
    scan = load(stage / 'secret-scan.json')
    assert scan['candidate'] == head and scan['mergeBase'] == BASE and scan['files'] == hashes, 'Stage changed after scan.'
    assert scan['requiredSecretSources'] == ['WORKOS_API_KEY', 'AXIOM_API_KEY'] and scan['configuredSecretValuesChecked'] >= 2 and not scan['matchedFiles'], 'Both configured secrets must pass the exact-value scan.'
    approved = load(stage / 'approved-inventory.json')
    assert approved['approved'] is True and approved['complete'] is True and approved['candidate'] == head, 'Final manager inventory approval required.'
    assert set(hashes) == set(approved['files']) | {'approved-inventory.json', 'provenance.json'}, 'Unexpected staged file set.'
    for name, record in approved['files'].items():
        assert hashes[name] == record['sha256'], 'Approved bytes changed.'
    manager = load(stage / 'review/manager-review-final.json')
    assert manager['candidate'] == head and manager['mergeBase'] == BASE and manager['reviewed'] is True, 'Final manager review is required.'
    assert not git('ls-remote', '--heads', 'origin', BRANCH), 'Evidence branch already exists; do not overwrite it.'
    manifest = {'candidate': head, 'mergeBase': BASE, 'gateHead': metadata['gateHead'], 'files': {**hashes, 'secret-scan.json': digest(stage / 'secret-scan.json')}}
    manifest_path = stage / 'manifest.json'
    assert not manifest_path.exists(), 'Manifest already exists; inspect the prior publication attempt.'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    files = sorted(path for path in stage.rglob('*') if path.is_file())
    descriptor, index = tempfile.mkstemp(prefix='pr251-r2-evidence-index-')
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
            assert not any(char in name for char in '\n\t\0'), 'Unsafe publication Git path.'
            oid = isolated_git('hash-object', '-w', '--stdin', input=path.read_bytes()).decode().strip()
            records.append(f'100644 {oid}\t{name}\0'.encode())
        isolated_git('update-index', '-z', '--index-info', input=b''.join(records))
        tree = isolated_git('write-tree').decode().strip()
        assert isolated_git('ls-tree', '-r', '--name-only', tree).decode().splitlines() == sorted(prefix + path.relative_to(stage).as_posix() for path in files), 'Unexpected publication tree.'
        assert git('rev-parse', 'HEAD') == head and not git('status', '--porcelain'), 'Candidate changed before publication.'
        commit = isolated_git('commit-tree', tree, input=f'Preserve PR 251 evidence for {head}\n'.encode()).decode().strip()
        subprocess.run(['git', 'push', f'--force-with-lease=refs/heads/{BRANCH}:', 'origin', f'{commit}:refs/heads/{BRANCH}'], check=True)
        url = f'https://github.com/tomer-mayara/Thermus/tree/{commit}/{PREFIX}/{head}'
        result = {**metadata, 'evidenceCommit': commit, 'fileCount': len(files), 'url': url}
        (PUBLICATION / 'published.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({key: result[key] for key in ['candidate', 'evidenceCommit', 'branch', 'fileCount', 'url']}))
    finally:
        Path(index).unlink(missing_ok=True)


if __name__ == '__main__':
    main()
