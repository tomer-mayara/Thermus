"""Inventory or stage allowlisted PR 251 rebase evidence; never publish."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path.cwd().resolve()
CACHE = ROOT / '.cache/rebase251'
BASE = '581f30cfaa32b01399422b087b0f0bdc3b800f70'
GATE_HEAD = 'e1e55dc04f5afa1e46eab5946067683fa496aaa6'
BRANCH = 'codex/s2-5-01a-rebase-evidence'
PREFIX = 'review-evidence/s2-5-01a-rebase'
BLOCKED = re.compile(r'user[-_ ]?draft|preservation|production-cutover|credential|(^|/)\.env|raw[-_]?v8|s25-r1|s2-5-r1|(^|/)(keys?|secrets?)(/|\.)|(^|/)(coverage|process|signal)-\d+-|(^|/)(seal-request|seal-receipt|loader)-', re.I)
EXTENSIONS = {'.md', '.json', '.mmd', '.svg', '.png', '.txt', '.diff', '.patch', '.html', '.js', '.mjs', '.py', '.css', '.webp', '.log'}
LOG_NAME = re.compile(r'(?:install|focused-build|conflict-focused|changed-tests|colima-start|colima-cleanup|habit-hooks|api-surface|final-api-check|ordinary|typecheck|portal|hosted-live|native-container|hosted-container|hosted-build|coverage|metrics|snapshot|crap|pr-review|quality)(?:[-\w.]*)\.log')
METRICS = ['process.json', 'process.md', 'review.json', 'review.md', 'snapshot-base.json', 'snapshot.json', 'crap.json', 'coverage.json', 'impact.json', 'pr-review.json', 'metrics.txt']
OPTIONAL_PROVENANCE = ['coverage-command.json', 'metrics-command-results.json', 'gated-inputs.json', 'docker-before.json', 'docker-after.json', 'final-ci-observation.json']


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def read_json(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_file(path):
    relative = path.relative_to(ROOT)
    assert not BLOCKED.search(relative.as_posix()), f'Excluded input: {relative}'
    assert path.is_file(), f'Missing normal file: {relative}'
    for parent in [path, *path.parents]:
        if parent == ROOT:
            break
        assert not parent.is_symlink(), 'Symlink input excluded.'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['inventory', 'stage'])
    parser.add_argument('candidate', help='Current full committed HEAD')
    args = parser.parse_args()
    head = git('rev-parse', 'HEAD')
    assert re.fullmatch(r'[0-9a-f]{40}', args.candidate) and args.candidate == head, 'Supply current full HEAD.'
    assert not git('status', '--porcelain'), 'Candidate must be committed and clean.'
    assert git('rev-parse', 'origin/main') == BASE, 'Main moved; refresh comparison before publication.'
    assert git('merge-base', BASE, head) == BASE, 'Candidate must descend from the pinned main.'
    checker = read_json(ROOT / 'ast-report/pr-review.json')
    assert checker['candidate'] == head and checker['mergeBase'] == BASE, 'Stale checker pins.'
    impact = read_json(ROOT / 'ast-report/impact.json')
    assert impact['head'] == head and impact['base'] == BASE, 'Stale stamped impact.'
    assert read_json(ROOT / '.habit-hooks/snooze.json') == [], 'Habit snooze must remain empty.'
    for filename in ['manager-review-final.json', 'architecture/provenance-final.json']:
        data = read_json(CACHE / filename)
        assert data['candidate'] == head and data['mergeBase'] == BASE, f'Stale {filename}.'
        if filename.startswith('manager'):
            assert data['reviewed'] is True, 'Manager sign-off is required.'

    snapshot = read_json(ROOT / 'ast-report/snapshot.json')
    base_snapshot = read_json(ROOT / 'ast-report/snapshot-base.json')
    process = read_json(ROOT / 'ast-report/process.json')
    crap = read_json(ROOT / 'ast-report/crap.json')
    review = read_json(ROOT / 'ast-report/review.json')
    assert snapshot['commit'] == head and base_snapshot['commit'] == BASE, 'Stale snapshots.'
    assert process['head'] == head and process['base'] == BASE, 'Stale metrics process.'
    assert crap['head'] == head and crap['base'] == BASE, 'Stale CRAP report.'
    assert review['headSha'] == head and review['baseSha'] == BASE, 'Stale metrics review.'
    coverage = read_json(ROOT / 'ast-report/coverage.json')
    provenance = coverage['provenance']
    assert provenance['status'] == 'verified', 'Verified current coverage required.'
    identity = provenance.get('comparisonIdentity', provenance)
    for key in ['sourceFingerprint', 'inputsFingerprint', 'runtime', 'compiler', 'measurementVersion']:
        assert identity[key] == snapshot['provenance'][key], f'Coverage identity differs: {key}'
    assert identity['runtime'] == 'node-24.20.0', 'Pinned runtime required.'

    bridge = read_json(CACHE / 'final-input-binding.json')
    assert bridge['candidate'] == head and bridge['mergeBase'] == BASE and bridge['gateHead'] == GATE_HEAD, 'Stale gate binding.'
    assert bridge['sourceAndGateInputsUnchanged'] is True, 'Unchanged gate-input confirmation required.'
    for key in ['sourceFingerprint', 'inputsFingerprint']:
        assert bridge[key] == identity[key], f'Stale gate-input {key}.'
    changes = git('diff', '--name-only', GATE_HEAD, head).splitlines()
    assert sorted(bridge['changedPathsSinceGate']) == sorted(changes), 'Gate bridge must inventory the exact final diff.'
    assert all(path.startswith('docs/') for path in changes), 'Only source-free documentation/history changes may bridge gates.'
    assert bridge['permittedChanges'] == 'source-free documentation/metric history only', 'Gate binding scope missing.'
    gate_inputs = read_json(CACHE / 'gated-inputs.json')
    assert gate_inputs['head'] == GATE_HEAD and gate_inputs['base'] == BASE, 'Stale original gate-input inventory.'
    for filename, expected_hash in gate_inputs['files'].items():
        if filename not in changes:
            assert digest(ROOT / filename) == expected_hash, 'A recorded gate input changed outside the documentation bridge.'

    ledger = read_json(CACHE / 'gate-ledger.json')
    assert isinstance(ledger, list) and ledger, 'Nonempty gate ledger required.'
    required = {'api-surface', 'ordinary', 'typecheck', 'portal', 'hosted-live', 'native-container', 'hosted-container'}
    assert required <= {row['name'] for row in ledger}, 'Required gate record missing.'
    for row in ledger:
        assert row.get('finished') and ('code' in row or 'signal' in row or row.get('status') == 'unavailable'), 'Unfinished gate record.'
        if row.get('status') == 'unavailable':
            assert row.get('reason'), 'Unavailable is not a pass; record its reason.'
        assert Path(row['log']).name == row['log'] and LOG_NAME.fullmatch(row['log']), 'Unsafe or unlisted gate log.'
        safe_file(CACHE / row['log'])

    sources = {}
    def add(path, target):
        safe_file(path)
        target = Path(target)
        assert not target.is_absolute() and '..' not in target.parts, 'Unsafe stage target.'
        assert target.as_posix() not in sources, 'Duplicate stage target.'
        sources[target.as_posix()] = path

    for path in sorted(CACHE.glob('*.log')):
        assert LOG_NAME.fullmatch(path.name), f'Unlisted rebase log; review before allowlisting: {path.name}'
        add(path, Path('checks') / path.name)
    for filename in ['gate-ledger.json', 'initial-pr-history.json', 'range-diff.txt', 'manager-review-final.json', 'final-input-binding.json']:
        add(CACHE / filename, Path('review') / filename)
    for filename in OPTIONAL_PROVENANCE:
        path = CACHE / filename
        if path.exists():
            add(path, Path('review') / filename)
    # Preserve command exit provenance and unmodified first-run reports after
    # the final documentation/history commit requires fresh comparison pins.
    first_metrics = CACHE / 'history/first-metrics'
    if head != GATE_HEAD:
        original = read_json(first_metrics / 'process.json')
        assert original['head'] == GATE_HEAD and original['base'] == BASE, 'Original first metrics history required.'
    for path in sorted(first_metrics.rglob('*')):
        if path.is_file() and path.suffix in EXTENSIONS:
            add(path, Path('history/first-metrics') / path.relative_to(first_metrics))
    # Only current rebase review artifacts. Never walk old R1 caches or the checkout.
    for folder in ['review', 'architecture', 'quality', 'report-drafts']:
        for path in sorted((CACHE / folder).rglob('*')):
            if path.is_file() and path.suffix in EXTENSIONS and (folder == 'report-drafts' or not path.name.endswith('.pending.md')):
                add(path, Path(folder) / path.relative_to(CACHE / folder))
    for path in sorted(CACHE.glob('quality-*')):
        if path.is_file() and path.suffix in {'.md', '.json', '.txt'} and not path.name.endswith('.pending.md'):
            add(path, Path('quality') / path.name)
    for filename in METRICS:
        add(ROOT / 'ast-report' / filename, Path('metrics') / filename)
    # The complete current Markdown/JSON reports suffice. Do not include stale
    # shared HTML/data output left by an earlier R1 analysis.
    captures = provenance.get('captures') or [provenance]
    assert captures and all(capture.get('status') == 'verified' for capture in captures), 'Verified capture identities required.'
    manifests = list((ROOT / 'ast-report/coverage-captures').glob('*/capture-manifest.json'))
    for capture in captures:
        capture_id = capture['captureId']
        assert re.fullmatch(r'[A-Za-z0-9_-]+', capture_id), 'Unsafe capture ID.'
        matches = [path for path in manifests if read_json(path).get('captureId') == capture_id]
        assert len(matches) == 1, 'One original manifest is required for each capture.'
        manifest = read_json(matches[0])
        assert manifest['capturedCommit'] == capture['capturedCommit'], 'Capture commit mismatch.'
        assert digest(matches[0]) == capture['captureManifestFingerprint'], 'Capture manifest hash mismatch.'
        add(matches[0], Path('coverage-captures') / capture_id / 'capture-manifest.json')
    # Only changed committed files plus the three safety declarations.
    changed = git('diff', '--name-only', '--diff-filter=ACMRT', BASE, head).splitlines()
    for filename in sorted(set(changed) | {'.pr-impact.json', '.code-quality-exceptions.yaml', '.habit-hooks/snooze.json'}):
        path = ROOT / filename
        assert subprocess.check_output(['git', 'show', f'{head}:{filename}']) == path.read_bytes(), 'Candidate snapshot differs from committed content.'
        add(path, Path('candidate') / filename)
    for filename in ['README.md', 'QUALITY.md', 'VALIDATION.md']:
        path = CACHE / 'publication-text' / filename
        assert not re.search(r'__FINAL|__EVIDENCE|__PENDING', path.read_text()), 'Resolve publication placeholders first.'
        add(path, filename)
    for filename in ['prepare-review-evidence.py', 'scan-review-evidence.mjs', 'scan-with-configured-secrets.mjs', 'publish-review-evidence.py', 'evidence-helper-handoff.md']:
        add(CACHE / filename, Path('tooling') / filename)
    files = {target: {'source': path.relative_to(ROOT).as_posix(), 'sha256': digest(path)} for target, path in sorted(sources.items())}
    binding = {'candidate': head, 'mergeBase': BASE, 'gateHead': GATE_HEAD, 'evidenceComplete': False, 'files': files}
    if args.mode == 'inventory':
        (CACHE / 'final-binding-template.json').write_text(json.dumps(binding, indent=2) + '\n')
        print(json.dumps({'candidate': head, 'mergeBase': BASE, 'files': len(files), 'template': '.cache/rebase251/final-binding-template.json'}))
        return
    final_binding = read_json(CACHE / 'final-binding.json')
    assert final_binding == {**binding, 'evidenceComplete': True}, 'Manager must confirm this exact inventory as complete.'
    stage = CACHE / 'publish' / PREFIX / head
    assert not stage.exists(), 'Stage exists; inspect it instead of overwriting it.'
    stage.mkdir(parents=True)
    for target, source in sources.items():
        destination = stage / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        assert digest(destination) == files[target]['sha256'] == digest(source), 'Evidence changed during copy.'
    shutil.copyfile(CACHE / 'final-binding.json', stage / 'final-binding.json')
    metadata = {'candidate': head, 'mergeBase': BASE, 'gateHead': GATE_HEAD, 'branch': BRANCH, 'prefix': PREFIX, 'stage': str(stage), 'rawV8Included': False, 'checkerEligibility': checker['eligibility'], 'checkerBlockers': checker['blockers'], 'humanApproval': 'Not established by this helper', 'release': 'No release or live deletion proof claimed'}
    (stage / 'provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (CACHE / 'publish-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    assert git('rev-parse', 'HEAD') == head and not git('status', '--porcelain'), 'Candidate changed during staging.'
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
