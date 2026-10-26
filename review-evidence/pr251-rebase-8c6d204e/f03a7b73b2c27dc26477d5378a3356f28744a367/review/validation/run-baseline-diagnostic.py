"""Build an exact main archive in an owned temp folder and run one runtime file."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone

root = Path.cwd().resolve()
output = root / '.cache/pr251-rebase-8c6d204e/validation'
base = '8c6d204e8588a664438ba8934ab36670b802525f'
node_bin = '/Users/tomermayara/.nvm/versions/node/v24.20.0/bin'
context = 'colima-thermus-pr251-r2'
assert subprocess.check_output(['git', 'rev-parse', 'origin/main'], text=True).strip() == base
owned = Path(tempfile.mkdtemp(prefix='thermus-pr251-baseline-', dir='/tmp')).resolve()
record = {'purpose': 'Independent exact-main diagnostic of the inherited SQL/Audit fixture; not a complete baseline suite pass.', 'base': base, 'candidateGateHead': 'fd7fa0b1e53d653f92168b75ba4d65618a9138a8', 'temporaryDirectory': str(owned), 'dockerContext': context, 'commands': [], 'cleanup': 'pending'}
def now():
    return datetime.now(timezone.utc).isoformat()
def save():
    (output / 'baseline-diagnostic.json').write_text(json.dumps(record, indent=2) + '\n')
def run(command, log):
    started = now()
    with (output / log).open('xb') as stream:
        result = subprocess.run(command, cwd=owned, env=environment, stdin=subprocess.DEVNULL, stdout=stream, stderr=subprocess.STDOUT)
    row = {'command': command, 'cwd': str(owned), 'started': started, 'finished': now(), 'exit': result.returncode, 'log': log, 'logSha256': hashlib.sha256((output / log).read_bytes()).hexdigest()}
    record['commands'].append(row)
    save()
    print(json.dumps(row), flush=True)
    return result.returncode
try:
    archive = subprocess.check_output(['git', 'archive', '--format=tar', base], cwd=root)
    record['archiveSha256'] = hashlib.sha256(archive).hexdigest()
    subprocess.run(['tar', '-xf', '-', '-C', str(owned)], input=archive, check=True)
    (owned / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
    record['nodeModulesSymlink'] = str(root / 'node_modules')
    paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', base], cwd=root, text=True).splitlines()
    identity_paths = [name for name in paths if name.startswith(('src/', 'test/', 'sql/')) or name in ['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'tsconfig.build.json', '.npmrc', '.nvmrc']]
    record['archivedInputHashes'] = {name: hashlib.sha256((owned / name).read_bytes()).hexdigest() for name in identity_paths}
    record['portal'] = 'Uses the unchanged tracked offline hosted-portal fixture through the test preload; no portal build or application-source change.'
    environment = {**os.environ, 'PATH': node_bin + os.pathsep + os.environ.get('PATH', ''), 'DOCKER_CONTEXT': context}
    removed = [key for key in environment if key.startswith(('WORKOS_', 'AXIOM_', 'AXOIM_')) or key in ['DOCKER_HOST', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'BUILDX_BUILDER', 'DATABASE_URL', 'DATABASE_CA_CERT_PATH']]
    for key in removed:
        del environment[key]
    record['removedAmbientSettingNames'] = removed
    record['nodeVersion'] = subprocess.check_output([node_bin + '/node', '--version'], env=environment, text=True).strip()
    assert record['nodeVersion'] == 'v24.20.0'
    save()
    build_exit = run([node_bin + '/npm', 'run', 'build'], 'baseline-build.log')
    if build_exit != 0:
        record['testStatus'] = 'not run: baseline build failed; no extra setup attempted'
    else:
        record['testExit'] = run([node_bin + '/node', '--test', '--test-concurrency=1', 'dist/test/acceptance/logging/audit/hosted-storage-failure.runtime.js'], 'baseline-hosted-storage-failure.log')
    assert all(hashlib.sha256((owned / name).read_bytes()).hexdigest() == digest for name, digest in record['archivedInputHashes'].items()), 'Archived source or test bytes changed.'
    record['archivedInputsUnchangedAfterRun'] = True
finally:
    assert owned.name.startswith('thermus-pr251-baseline-') and owned.parent == Path('/tmp').resolve()
    shutil.rmtree(owned)
    record['cleanup'] = 'Only the owned temporary archive was removed. The source worktree and shared node_modules were not changed.'
    record['temporaryDirectoryAbsent'] = not owned.exists()
    save()
    print(json.dumps({'record': str(output / 'baseline-diagnostic.json'), 'cleanup': record['cleanup']}), flush=True)
