"""Inventory or stage R1 evidence. Neither mode commits or publishes."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path.cwd().resolve()
CACHE = ROOT / '.cache/s25-r1'
PARENT_REF = 'origin/codex/s2-5-02-removal-verification'
PARENT_EVIDENCE = 'https://github.com/tomer-mayara/Thermus/tree/339b5716dab08f2195c2d88330a7707b776fca52/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f'
ALLOWED = {'.md', '.json', '.mmd', '.svg', '.png', '.diff', '.log', '.html', '.txt', '.css', '.js', '.jsonl', '.patch', '.sql'}
BLOCKED = re.compile(r'user[-_ ]?draft|production-cutover|credential|(^|/)\.env|raw[-_]?v8', re.I)

def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()

def read_json(path):
    return json.loads(path.read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def safe_file(path):
    assert path.is_file(), f'Missing evidence: {path.relative_to(ROOT)}'
    assert path.is_relative_to(ROOT), 'Input escaped the checkout.'
    assert not any(part.is_symlink() for part in [path, *path.parents] if part != ROOT.parent), 'Symlink input excluded.'
    assert not BLOCKED.search(path.relative_to(ROOT).as_posix()), 'Excluded input name.'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['inventory', 'stage'])
    parser.add_argument('candidate', help='Full committed candidate SHA')
    args = parser.parse_args()
    head = git('rev-parse', 'HEAD')
    assert re.fullmatch(r'[0-9a-f]{40}', args.candidate) and args.candidate == head, 'Supply the current full HEAD.'
    assert not git('status', '--porcelain'), 'Commit the complete candidate and remove unrelated untracked files first.'
    parent_tip = git('rev-parse', PARENT_REF)
    parent = git('merge-base', PARENT_REF, head)
    main_tip = git('rev-parse', 'origin/main')
    main_base = git('merge-base', 'origin/main', head)
    checker = read_json(ROOT / 'ast-report/pr-review.json')
    assert checker['candidate'] == head and checker['mergeBase'] == parent, 'Stale parent checker pins.'
    impact = read_json(ROOT / 'ast-report/impact.json')
    assert impact['head'] == head and impact['base'] == parent, 'Stale stamped impact.'
    assert read_json(ROOT / '.habit-hooks/snooze.json') == [], 'Habit snooze must remain empty.'
    for filename in ['manager-review-final.json', 'architecture/provenance-final.json']:
        data = read_json(CACHE / filename)
        assert data['candidate'] == head and data['parentMergeBase'] == parent, f'Stale {filename}.'
        if filename.startswith('manager'):
            assert data['reviewed'] is True, 'Manager has not signed off the committed candidate.'
    ledger = read_json(CACHE / 'gate-ledger.json')
    assert isinstance(ledger, list) and ledger, 'Gate ledger must be a nonempty array.'
    required = {'install', 'api-surface', 'ordinary', 'typecheck', 'portal', 'postgres', 'collector', 'browser', 'hosted-live', 'native-container', 'hosted-container'}
    assert required <= {row['name'] for row in ledger}, 'Required gate row missing.'
    for row in ledger:
        assert row.get('finished') and ('code' in row or 'signal' in row), 'Unfinished gate row.'
        assert Path(row['log']).name == row['log'], 'Unsafe gate log path.'
        safe_file(CACHE / row['log'])

    sources = {}
    def add(path, target):
        safe_file(path)
        target = Path(target)
        assert not target.is_absolute() and '..' not in target.parts, 'Unsafe stage path.'
        assert target.as_posix() not in sources, 'Duplicate evidence target.'
        sources[target.as_posix()] = path

    # Root logs preserve red/green, retries, resource setup and cleanup history.
    # This code runs only after the coordinator declares all evidence complete.
    for path in sorted(CACHE.glob('*.log')):
        add(path, Path('checks') / path.name)
    required_cache = ['gate-ledger.json', 'test-selection.md', 'environment.md', 'implementation.md', 'review-domain.md', 'manager-review-final.json', 'coverage-command.json', 'metrics-command-results.json']
    for filename in required_cache:
        add(CACHE / filename, Path('review') / filename)
    for path in sorted(CACHE.glob('*.json')):
        if path.name.startswith(('gated-inputs-', 'manager-review-working', 'cleanup', 'colima-', 'docker-', 'final-candidate')):
            add(path, Path('history') / path.name)
    for folder in ['review', 'architecture', 'cleanup', 'history', 'pr-history', 'live']:
        for path in sorted((CACHE / folder).rglob('*')):
            if path.is_file() and path.suffix in ALLOWED and not path.name.endswith('.pending.md') and 'gate-ledger-snapshot-draft' not in path.name:
                add(path, Path(folder) / path.relative_to(CACHE / folder))
    add(CACHE / 'browser/members-remove-narrow.png', 'browser/members-remove-narrow.png')
    for filename in ['process.json', 'process.md', 'review.json', 'review.md', 'crap.json', 'coverage.json', 'snapshot-base.json', 'snapshot.json', 'impact.json', 'pr-review.json', 'metrics.txt']:
        add(ROOT / 'ast-report' / filename, Path('metrics') / filename)
    for folder in ['data', 'images']:
        for path in sorted((ROOT / 'ast-report' / folder).rglob('*')):
            if path.is_file() and path.suffix in ALLOWED:
                add(path, Path('metrics') / folder / path.relative_to(ROOT / 'ast-report' / folder))
    for path in sorted((ROOT / 'ast-report').glob('*.html')):
        add(path, Path('metrics') / path.name)
    coverage = read_json(ROOT / 'ast-report/coverage.json')
    captures = coverage['provenance']['captures']
    assert captures, 'Verified coverage capture identities required.'
    for capture in captures:
        capture_id = capture['captureId']
        assert re.fullmatch(r'[A-Za-z0-9_-]+', capture_id), 'Unsafe capture ID.'
        matches = [path for path in (ROOT / 'ast-report/coverage-captures').glob('*/capture-manifest.json') if read_json(path).get('captureId') == capture_id]
        assert len(matches) == 1, 'Expected one manifest for each capture.'
        manifest = read_json(matches[0])
        assert manifest['capturedCommit'] == capture['capturedCommit'], 'Coverage commit mismatch.'
        assert digest(matches[0]) == capture['captureManifestFingerprint'], 'Coverage manifest hash mismatch.'
        add(matches[0], Path('coverage-captures') / capture_id / 'capture-manifest.json')
    # Snapshot the R1 increment, not inherited giant reports or the user's draft.
    changed = git('diff', '--name-only', '--diff-filter=ACMRT', parent, head).splitlines()
    snapshot_paths = set(changed) | {'.pr-impact.json', '.code-quality-exceptions.yaml', '.habit-hooks/snooze.json'}
    snapshot_paths |= set(git('ls-tree', '-r', '--name-only', head, 'docs/api-surface').splitlines())
    for filename in sorted(snapshot_paths):
        path = ROOT / filename
        assert git('ls-files', '--error-unmatch', filename), 'Only committed candidate snapshots are allowed.'
        add(path, Path('candidate') / filename)
    for filename in ['README.md', 'QUALITY.md', 'VALIDATION.md']:
        add(CACHE / 'publication-text' / filename, filename)
    for filename in ['prepare-review-evidence.py', 'scan-review-evidence.mjs', 'publish-review-evidence.py', 'evidence-helper-handoff.md']:
        add(CACHE / filename, Path('tooling') / filename)
    hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in sources.values()}
    binding = {'candidate': head, 'parentMergeBase': parent, 'evidenceComplete': False, 'files': hashes}
    if args.mode == 'inventory':
        (CACHE / 'final-binding-template.json').write_text(json.dumps(binding, indent=2) + '\n')
        print(json.dumps({'candidate': head, 'files': len(sources), 'template': '.cache/s25-r1/final-binding-template.json'}))
        return
    final_binding = read_json(CACHE / 'final-binding.json')
    assert final_binding == {**binding, 'evidenceComplete': True}, 'Final binding differs from this exact evidence inventory.'
    stage = CACHE / 'publish/review-evidence/s2-5-r1' / head
    assert not stage.exists(), 'Stage exists; inspect it rather than overwriting it.'
    stage.mkdir(parents=True)
    try:
        for target, source in sources.items():
            dest = stage / target
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, dest)
            assert digest(dest) == hashes[source.relative_to(ROOT).as_posix()], 'Evidence changed while copying.'
        shutil.copyfile(CACHE / 'final-binding.json', stage / 'final-binding.json')
        provenance = {'candidate': head, 'parentRef': PARENT_REF, 'parentTip': parent_tip, 'parentMergeBase': parent, 'mainTip': main_tip, 'mainMergeBase': main_base, 'checkerEligibility': checker['eligibility'], 'checkerBlockers': checker['blockers'], 'parentEvidence': PARENT_EVIDENCE, 'rawV8Included': False, 'humanApproval': 'Not established by this helper', 'release': 'No release claimed; draft and human review holds remain separate.'}
        (stage / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
        (stage / 'parent-evidence.md').write_text(f'# Parent evidence\n\n[Retained S2.5-02 evidence]({PARENT_EVIDENCE}). These reports are historical; R1 evidence is recorded separately.\n')
        metadata = {**provenance, 'stage': str(stage), 'fileCount': len(sources) + 3}
        (CACHE / 'publish-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
        assert not git('status', '--porcelain') and git('rev-parse', 'HEAD') == head, 'Candidate changed while staging.'
        print(json.dumps(metadata))
    except BaseException:
        # Keep partial cache evidence for inspection. No checkout/index mutation occurred.
        raise

if __name__ == '__main__':
    main()
