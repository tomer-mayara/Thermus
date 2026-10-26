"""Preview, inventory, or stage explicit current PR 251 evidence. Never publish."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path.cwd().resolve()
CACHE = ROOT / '.cache/pr251-rebase-8c6d204e'
PUBLICATION = CACHE / 'publication'
BASE = '8c6d204e8588a664438ba8934ab36670b802525f'
GATE_HEAD = 'fd7fa0b1e53d653f92168b75ba4d65618a9138a8'
BRANCH = 'codex/pr251-rebase-8c6d204e-evidence'
PREFIX = 'review-evidence/pr251-rebase-8c6d204e'
BLOCKED = re.compile(r'user[-_ ]?draft|preservation|production-cutover|credential|(^|/)\.env|raw[-_]?v8|(^|/)(keys?|secrets?)(/|\.)|(^|/)(coverage|process|signal)-\d+-|(^|/)(seal-request|seal-receipt|loader)-', re.I)
LOG = re.compile(r'(?:(?:install|runtime|api-surface|focused-build|focused|ordinary|typecheck|portal|hosted-live|native-container|hosted-container|logging-postgres|logging-collector|diff-check)(?:-\d+)?|(?:colima|habit-hooks|coverage|metrics|snapshot|process|crap|pr-review|quality|final-api-check)[-\w.]*|docker-build-\d+-\d+)\.log')
REQUIRED_GATES = {'install', 'runtime', 'api-surface', 'focused-build', 'focused', 'ordinary', 'typecheck', 'portal', 'hosted-live', 'native-container', 'hosted-container', 'logging-postgres', 'logging-collector'}


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def load(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe(path):
    assert path.is_relative_to(ROOT), 'Evidence source must be inside the checkout.'
    assert not BLOCKED.search(path.relative_to(ROOT).as_posix()), 'Excluded evidence path.'
    assert path.is_file(), f'Missing evidence: {path.relative_to(ROOT)}'
    assert not any(parent.is_symlink() for parent in [path, *path.parents] if parent != ROOT), 'Symlink evidence is excluded.'



def blocked_draft_check(head, latest):
    record = load(CACHE / 'blocked-draft.json')
    assert record['candidate'] == head and record['mergeBase'] == BASE and record['gateHead'] == GATE_HEAD, 'Stale blocked-Draft decision.'
    assert record['reviewed'] is True and record['overallMergeStatus'] == 'blocked' and record['ready'] is False and record['draft'] is True, 'Manager must explicitly retain blocked Draft status.'
    gate = record['failedGate']
    assert gate['name'] == 'logging-postgres' and gate['attempt'] == latest['attempt'] and gate['code'] == latest['code'] != 0, 'Only the named PostgreSQL failure can remain blocked.'
    assert gate['log'] == latest['log'] and gate['sha256'] == digest(CACHE / latest['log']), 'Failed gate evidence changed.'
    proof = record['baselineProof']
    assert proof['record'] == 'validation/baseline-diagnostic.json' and proof['sha256'] == digest(CACHE / proof['record']), 'Exact-main diagnostic record changed.'
    baseline = load(CACHE / proof['record'])
    assert baseline['base'] == BASE and baseline['candidateGateHead'] == GATE_HEAD and baseline['nodeVersion'] == 'v24.20.0', 'Baseline diagnostic pins or runtime differ.'
    archive = subprocess.check_output(['git', 'archive', '--format=tar', BASE])
    assert baseline['archiveSha256'] == hashlib.sha256(archive).hexdigest(), 'Baseline archive does not match exact main.'
    assert baseline['archivedInputsUnchangedAfterRun'] is True and baseline['temporaryDirectoryAbsent'] is True, 'Baseline identity and cleanup proof required.'
    assert baseline['testExit'] == 1 and len(baseline['commands']) == 2, 'Baseline must contain only its build and focused runtime diagnostic.'
    build, test = baseline['commands']
    assert build['exit'] == 0 and build['command'][-2:] == ['run', 'build'], 'Exact-main TypeScript build must succeed.'
    assert test['exit'] == 1 and test['command'][1:] == ['--test', '--test-concurrency=1', 'dist/test/acceptance/logging/audit/hosted-storage-failure.runtime.js'], 'Baseline diagnostic selection differs.'
    for command in baseline['commands']:
        path = CACHE / 'validation' / command['log']
        assert command['logSha256'] == digest(path), 'Baseline command log changed.'
    retry = record['focusedRetry']
    assert retry['log'] == 'quality-postgres-focused.log' and retry['code'] == 1 and retry['sha256'] == digest(CACHE / retry['log']), 'Candidate focused retry evidence changed.'
    for path in [CACHE / 'validation' / test['log'], CACHE / retry['log']]:
        text = path.read_text()
        counts = dict(re.findall(r'^(?:ℹ|#) (tests|pass|fail|cancelled|skipped|todo) (\d+)$', text, re.M))
        assert counts == {'tests': '2', 'pass': '1', 'fail': '1', 'cancelled': '0', 'skipped': '0', 'todo': '0'}, 'Both focused cases must run without skips.'
        assert 'Product and Admin results complete while the queue attempt authorization still waits for SQL.' in text and 'true !== false' in text, 'Focused and baseline failure assertions differ.'
    assert record.get('reason'), 'Retain the manager reason; baseline failure is not a gate pass.'


def strict_checks(head):
    assert git('rev-parse', 'HEAD') == head and not git('status', '--porcelain'), 'Final candidate must be current, committed and clean.'
    assert git('rev-parse', 'origin/main') == BASE and git('merge-base', BASE, head) == BASE, 'Pinned base changed.'
    for filename, head_key, base_key in [('pr-review.json', 'candidate', 'mergeBase'), ('impact.json', 'head', 'base'), ('process.json', 'head', 'base'), ('crap.json', 'head', 'base'), ('review.json', 'headSha', 'baseSha')]:
        report = load(ROOT / 'ast-report' / filename)
        assert report[head_key] == head and report[base_key] == BASE, f'Stale report: {filename}'
    snapshot = load(ROOT / 'ast-report/snapshot.json')
    assert snapshot['commit'] == head and load(ROOT / 'ast-report/snapshot-base.json')['commit'] == BASE, 'Stale snapshots.'
    coverage = load(ROOT / 'ast-report/coverage.json')['provenance']
    assert coverage['status'] == 'verified', 'Verified coverage is required.'
    identity = coverage.get('comparisonIdentity', coverage)
    for key in ['sourceFingerprint', 'inputsFingerprint', 'runtime', 'compiler', 'measurementVersion']:
        assert identity[key] == snapshot['provenance'][key], f'Coverage identity differs: {key}'
    assert identity['runtime'] == 'node-24.20.0', 'Pinned coverage runtime is required.'
    assert load(ROOT / '.habit-hooks/snooze.json') == [], 'Habit snooze must be empty.'
    bridge = load(CACHE / 'final-input-binding.json')
    assert bridge['candidate'] == head and bridge['mergeBase'] == BASE and bridge['gateHead'] == GATE_HEAD, 'Stale final gate binding.'
    assert bridge['sourceAndGateInputsUnchanged'] is True, 'Manager must confirm unchanged runtime/build inputs.'
    changes = git('diff', '--name-only', GATE_HEAD, head).splitlines()
    assert sorted(bridge['changedPathsSinceGate']) == sorted(changes), 'Final gate binding must list the exact delta.'
    assert all(path.startswith('docs/') for path in changes), 'Only source-free document/history changes can bridge gates.'
    for key in ['sourceFingerprint', 'inputsFingerprint']:
        assert bridge[key] == identity[key], f'Stale final gate binding: {key}'
    for filename in ['manager-review-final.json', 'architecture/provenance-final.json']:
        report = load(CACHE / filename)
        assert report['candidate'] == head and report['mergeBase'] == BASE, f'Stale final review: {filename}'
    assert load(CACHE / 'manager-review-final.json')['reviewed'] is True, 'Manager sign-off is required.'
    render = load(CACHE / 'architecture/render-report-final.json')
    for key, name in [('sourceSha256', 'comparison-final.mmd'), ('pngSha256', 'comparison-final-800.png'), ('svgSha256', 'comparison-final-800.svg')]:
        assert digest(CACHE / 'architecture' / name) == render[key], 'Architecture render bytes changed.'
    assert render['candidate'] == head and render['mergeBase'] == BASE, 'Stale architecture render pins.'
    summary = (CACHE / 'architecture/summary-comparison.md').read_text()
    embedded = re.search(r'```mermaid\n(.*?)\n```', summary, re.S)
    assert embedded and embedded.group(1) + '\n' == (CACHE / 'architecture/comparison-final.mmd').read_text(), 'Embedded Mermaid differs.'
    for name in ['README.md', 'VALIDATION.md', 'QUALITY.md']:
        assert not re.search(r'FINAL_HEAD_PENDING|__FINAL|__EVIDENCE|__PENDING|DRAFT: PENDING', (PUBLICATION / 'text' / name).read_text()), 'Resolve final text placeholders.'
    ledger = load(CACHE / 'gate-ledger.json')
    assert REQUIRED_GATES <= {row['name'] for row in ledger}, 'Selected gate record is missing.'
    latest = {name: [row for row in ledger if row['name'] == name][-1] for name in REQUIRED_GATES}
    failed = [name for name, row in latest.items() if row.get('code') != 0]
    if failed:
        assert failed == ['logging-postgres'], f'Unexpected selected gate failure: {failed}'
        blocked_draft_check(head, latest['logging-postgres'])
    for row in ledger:
        assert row['base'] == BASE and row['head'] == GATE_HEAD and row.get('finished'), 'Stale or incomplete gate record.'
        assert 'code' in row or row.get('status') == 'unavailable', 'Gate result is missing.'
        if row.get('status') == 'unavailable':
            assert row.get('reason'), 'Unavailable gate requires a reason; it is not a pass.'
        binding = load(CACHE / f"gated-inputs-{row['runId']}.json")
        assert binding['head'] == GATE_HEAD and binding['base'] == BASE and binding['inputFingerprint'] == row['inputFingerprint'], 'Gate input identity mismatch.'
        for filename, expected_hash in binding['files'].items():
            if filename not in changes:
                assert digest(ROOT / filename) == expected_hash, 'A gate input changed outside the permitted document bridge.'
    habit = load(CACHE / 'habit-command.json')
    assert habit['base'] == BASE and '--branch' in habit['command'] and 'origin/main' in habit['command'], 'Explicit complete-branch habit-hooks evidence is required.'
    hosted = load(CACHE / 'hosted-build-review.json')
    assert hosted['candidate'] == head and hosted['mergeBase'] == BASE and hosted['reviewed'] is True, 'Manager must review nested hosted offline build evidence.'
    assert hosted['freshChecksExecuted'] is True and hosted['linuxAmd64'] is True, 'Fresh Linux AMD64 hosted checks are required.'
    for name, expected_hash in hosted['logs'].items():
        assert LOG.fullmatch(name) and digest(CACHE / name) == expected_hash, 'Nested build evidence differs.'



def native_assets(strict):
    report_root = ROOT / 'ast-report'
    queue = [report_root / 'compare.html']
    assets = set()
    while queue:
        path = queue.pop().resolve()
        assert path.is_relative_to(report_root), 'Native metric asset escapes its report root.'
        assert path.is_file(), f'Missing linked native metric asset: {path}'
        if path in assets:
            continue
        assets.add(path)
        if path.suffix not in ['.html', '.css', '.js']:
            continue
        for reference in re.findall(r'(?<![:\w-])(?:href|src)\s*=\s*["\']([^"\']+)["\']', path.read_text()):
            local = reference.split('#')[0].split('?')[0]
            if not local or ':' in local or local.startswith('//'):
                continue
            # Vue/Alpine bindings and JavaScript-computed links are not static assets.
            if not re.fullmatch(r'[A-Za-z0-9_./-]+', local):
                continue
            queue.append(path.parent / local)
    if strict:
        data_path = report_root / 'data/data_All.js'
        assert data_path.resolve() in assets, 'Complete native graph data is required.'
        prefix, separator, encoded = data_path.read_text().partition('files:')
        assert separator, 'Cannot identify native metric source records.'
        records, _end = json.JSONDecoder().raw_decode(encoded)
        source_records = [record for record in records if record.get('shortPath', '').startswith('src/')]
        assert source_records, 'Native metric data contains no production source.'
        for record in source_records:
            path = (ROOT / record['shortPath']).resolve()
            assert path.is_relative_to(ROOT), 'Native source path escapes checkout.'
            assert record['checksum'] == 'sha256:' + digest(path), 'Native graph data has stale production source bytes.'
    return sorted(assets)


def collect(strict):
    sources = {}
    def add(source, target):
        path = ROOT / source
        assert not Path(target).is_absolute() and '..' not in Path(target).parts and not BLOCKED.search(target), 'Unsafe evidence target.'
        assert target not in sources, 'Duplicate evidence target.'
        sources[target] = path
    for target, source in load(PUBLICATION / 'file-set.json')['requiredFiles'].items():
        add(source, target)
    for path in sorted(CACHE.glob('*.log')):
        assert LOG.fullmatch(path.name), f'Unlisted log needs manager file-set review: {path.name}'
        add(str(path.relative_to(ROOT)), 'checks/' + path.name)
    ledger_path = CACHE / 'gate-ledger.json'
    if ledger_path.exists():
        for row in load(ledger_path):
            assert Path(row['log']).name == row['log'] and LOG.fullmatch(row['log']), 'Unsafe or unlisted ledger log.'
            assert (CACHE / row['log']).is_file(), 'Ledger log is missing.'
        for run_id in sorted({str(row['runId']) for row in load(ledger_path)}):
            assert run_id.isdigit(), 'Unsafe run identity.'
            add(str((CACHE / f'gated-inputs-{run_id}.json').relative_to(ROOT)), f'review/gated-inputs-{run_id}.json')
    for path in native_assets(strict):
        relative = path.relative_to(ROOT).as_posix()
        add(relative, relative)
    coverage_path = ROOT / 'ast-report/coverage.json'
    if coverage_path.exists():
        provenance = load(coverage_path)['provenance']
        captures = provenance.get('captures') or [provenance]
        manifests = list((ROOT / 'ast-report/coverage-captures').glob('*/capture-manifest.json'))
        for capture in captures:
            capture_id = capture['captureId']
            assert re.fullmatch(r'[A-Za-z0-9_-]+', capture_id), 'Unsafe capture ID.'
            matches = [path for path in manifests if load(path).get('captureId') == capture_id]
            assert len(matches) == 1, 'Each referenced coverage capture requires its original manifest.'
            if strict:
                assert capture['status'] == 'verified' and digest(matches[0]) == capture['captureManifestFingerprint'], 'Unverified or changed capture manifest.'
                assert load(matches[0])['capturedCommit'] == capture['capturedCommit'], 'Capture commit mismatch.'
            add(str(matches[0].relative_to(ROOT)), f'coverage-captures/{capture_id}/capture-manifest.json')
    return sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['preview', 'inventory', 'stage'])
    parser.add_argument('candidate')
    args = parser.parse_args()
    assert re.fullmatch(r'[0-9a-f]{40}', args.candidate), 'Supply the full candidate SHA.'
    strict = args.mode != 'preview'
    if strict:
        strict_checks(args.candidate)
    sources = collect(strict)
    missing = [target for target, path in sources.items() if not path.is_file()]
    if strict:
        assert not missing, f'Missing selected artifacts: {missing}'
    files = {}
    for target, path in sorted(sources.items()):
        if path.is_file():
            safe(path)
            files[target] = {'source': path.relative_to(ROOT).as_posix(), 'sha256': digest(path)}
    inventory = {'candidate': args.candidate, 'mergeBase': BASE, 'gateHead': GATE_HEAD, 'branch': BRANCH, 'prefix': PREFIX, 'complete': not missing and strict, 'approved': False, 'files': files, 'missing': missing}
    if args.mode in ['preview', 'inventory']:
        destination = PUBLICATION / ('stage-preview.json' if not strict else 'inventory-template.json')
        destination.write_text(json.dumps(inventory, indent=2) + '\n')
        print(json.dumps({'inventory': str(destination), 'files': len(files), 'missing': missing, 'complete': inventory['complete']}))
        return
    approved = load(PUBLICATION / 'approved-inventory.json')
    assert approved == {**inventory, 'approved': True}, 'Manager must approve this exact complete inventory before staging.'
    stage = PUBLICATION / 'stage' / PREFIX / args.candidate
    assert not stage.exists(), 'Do not overwrite an existing stage.'
    stage.mkdir(parents=True)
    for target, path in sources.items():
        destination = stage / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, destination)
        assert digest(destination) == files[target]['sha256'] == digest(path), 'Evidence changed during staging.'
    shutil.copyfile(PUBLICATION / 'approved-inventory.json', stage / 'approved-inventory.json')
    metadata = {'candidate': args.candidate, 'mergeBase': BASE, 'gateHead': GATE_HEAD, 'branch': BRANCH, 'prefix': PREFIX, 'stage': str(stage), 'rawV8Included': False, 'sourceCopiesIncluded': False, 'overallMergeStatus': 'blocked', 'ready': False, 'draft': True, 'failedGateDisposition': 'logging-postgres remains a failed required gate; exact-main reproduction supports the scoped rebase Draft only', 'previousEvidence': 'https://github.com/tomer-mayara/Thermus/tree/9a206af7fd3385c697b65903ab7f39e3fab39fea/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b', 'candidateUrl': f'https://github.com/tomer-mayara/Thermus/commit/{args.candidate}'}
    (stage / 'provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (PUBLICATION / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    assert git('rev-parse', 'HEAD') == args.candidate and not git('status', '--porcelain'), 'Candidate changed during staging.'
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
