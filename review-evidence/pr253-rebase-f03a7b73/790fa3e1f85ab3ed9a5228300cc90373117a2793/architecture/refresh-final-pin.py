#!/usr/bin/env python3
"""Bind reviewed architecture bytes to a final source-free candidate."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
GATE = 'fa5d4d7f57ef270df2a056ad523ec22e3b5032b6'
PARENT = 'f03a7b73b2c27dc26477d5378a3356f28744a367'
MAIN = '8c6d204e8588a664438ba8934ab36670b802525f'


def run(*args):
    return subprocess.check_output(args, cwd=ROOT)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def load(name):
    return json.loads((OUT / name).read_text())


def save(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2) + '\n')


def blocks(value):
    text = value.decode()
    result = []
    for index, match in enumerate(re.finditer(r'^```mermaid\n(.*?)^```', text, re.M | re.S)):
        headings = re.findall(r'^#{1,6} .+$', text[:match.start()], re.M)
        result.append({
            'index': index + 1,
            'heading': headings[-1].lstrip('# '),
            'startLine': text[:match.start()].count('\n') + 1,
            'endLine': text[:match.end()].count('\n') + 1,
            'sourceSha256': digest(match.group(1).encode()),
        })
    return result


def write_reports(candidate, validated, changed_paths):
    reviewed = load('reviewed-inputs-v1.json')
    before = run('git', 'show', f'{PARENT}:architecture/components.md')
    after = run('git', 'show', f'{candidate}:architecture/components.md')
    gate_registry = run('git', 'show', f'{GATE}:architecture/components.md')
    assert after == gate_registry, 'Registry differs from inspected source.'
    inventory = {
        'candidate': candidate, 'mergeBase': PARENT, 'main': MAIN, 'gateHead': GATE,
        'before': {'ref': PARENT, 'path': 'architecture/components.md', 'sha256': digest(before),
                   'url': f'https://github.com/tomer-mayara/Thermus/blob/{PARENT}/architecture/components.md', 'blocks': blocks(before)},
        'after': {'ref': candidate, 'path': 'architecture/components.md', 'sha256': digest(after),
                  'url': f'https://github.com/tomer-mayara/Thermus/blob/{candidate}/architecture/components.md', 'blocks': blocks(after)},
        'gateRegistryMatchesFinal': True,
    }
    assert len(inventory['before']['blocks']) == 13 and len(inventory['after']['blocks']) == 15
    save('inventory-final.json', inventory)
    for template, target in [('summary-comparison.template.md', 'summary-comparison.md'), ('assessment.template.md', 'assessment.md')]:
        text = (OUT / template).read_text().replace('__CANDIDATE__', candidate)
        assert '__CANDIDATE__' not in text
        (OUT / target).write_text(text)
    source = (OUT / 'comparison-final.mmd').read_bytes()
    summary = (OUT / 'summary-comparison.md').read_text()
    embedded = re.search(r'^```mermaid\n(.*?)^```', summary, re.M | re.S)
    assert embedded and embedded.group(1).encode() == source, 'Embedded comparison differs.'
    render = load('renders-v1/render-report-v2.json')
    rendered = []
    for item in render['diagrams']:
        row = dict(item)
        original_source = OUT / row['source']
        png = OUT / 'renders-v1' / row['image']
        svg = OUT / 'renders-v1' / row['vector']
        assert digest(original_source.read_bytes()) == row['sha256'], 'Rendered source changed.'
        assert digest(png.read_bytes()) == row['pngSha256'], 'PNG changed.'
        assert digest(svg.read_bytes()) == row['svgSha256'], 'SVG changed.'
        row['sourceSha256'] = row['sha256']
        row['image'] = 'renders-v1/' + row['image']
        row['vector'] = 'renders-v1/' + row['vector']
        if row['name'] == 'comparison-v2':
            row['source'] = 'comparison-final.mmd'
        else:
            block = inventory['after']['blocks'][row['index'] - 1]
            assert block['sourceSha256'] == row['sourceSha256'], 'Embedded registry source differs.'
            row['start_line'] = block['startLine']
            row['end_line'] = block['endLine']
        rendered.append(row)
    assert len(rendered) == 8
    render.update({
        'candidate': candidate, 'mergeBase': PARENT, 'main': MAIN, 'gateHead': GATE,
        'head': candidate, 'parent': PARENT, 'actualParent': PARENT,
        'sourceSha256': digest(source),
        'pngSha256': digest((OUT / 'comparison-final-800.png').read_bytes()),
        'svgSha256': digest((OUT / 'comparison-final-800.svg').read_bytes()),
        'registrySha256': digest(after), 'diagrams': rendered,
        'finalPinValidated': validated,
        'managerVisualReview': 'Manager inspected all eight fresh native 800 px renders and requested no diagram correction; final sign-off is recorded separately.',
    })
    assert render['sourceSha256'] == rendered[0]['sourceSha256']
    assert render['pngSha256'] == rendered[0]['pngSha256']
    assert render['svgSha256'] == rendered[0]['svgSha256']
    save('render-report-final.json', render)
    source_provenance = load('source-provenance-gate-head.json')
    for row in source_provenance['evidence']:
        old = row['revisions'].get(GATE)
        if old:
            final_bytes = run('git', 'show', f'{candidate}:{row["path"]}')
            assert digest(final_bytes) == old['sha256'], 'Reviewed source changed.'
            row['revisions'][candidate] = {**old, 'url': f'https://github.com/tomer-mayara/Thermus/blob/{candidate}/{row["path"]}#L1-L{old["lines"]}'}
    provenance = {
        'candidate': candidate, 'mergeBase': PARENT, 'parent': PARENT, 'main': MAIN, 'gateHead': GATE,
        'finalPinValidated': validated, 'sourceAndGateInputsUnchanged': validated,
        'changedPathsSinceGate': changed_paths,
        'reviewedInputsSha256': reviewed['sha256'],
        'reviewedInputState': 'All listed committed bytes verified.' if validated else 'Gate-pinned preparation; post-gate document bytes must be verified with --candidate.',
        'registry': inventory, 'sourceEvidence': source_provenance['evidence'],
        'comparison': {'summary': 'summary-comparison.md', 'source': 'comparison-final.mmd',
                       'png': 'comparison-final-800.png', 'svg': 'comparison-final-800.svg',
                       'sourceSha256': render['sourceSha256'], 'pngSha256': render['pngSha256'],
                       'svgSha256': render['svgSha256'], 'embeddedBytesMatch': True},
        'renders': rendered, 'renderReport': 'render-report-final.json',
        'inventories': ['inventory-final.json', 'inventory-gate-head.json'],
        'immutableHistoricalBinding': load('historical-binding.json'),
        'localLinkCheck': load('local-link-check.json'),
        'l4': {'strongestCallable': 'OrganizationAdministration.removeMember(actor, request)',
               'decision': 'Omit', 'reason': 'L3 plus notes explains authority, exact target, admission, deletion, matching receipt and lifetime at each real owner. L4 would repeat private phases.'},
        'workerReview': 'Conflicts, source, contracts, test specifications, registry, provenance and eight fresh 800 px renders reviewed. No behavior tests or live calls run by this worker.',
        'managerReview': 'Manager accepted semantic comparison with active-operation settlement wording and inspected all eight renders. Final candidate sign-off is separate.',
        'holds': ['S2.5-R1 remains open in this PR; the later PR 257 repair is outside this rebase.',
                  'Parent integration.', 'Independent authorized human architect approval of the current candidate.',
                  'Complete-candidate validation and any actual failed/unavailable gates are recorded separately.'],
        'historicalValidationReusedAsCurrent': False,
    }
    save('provenance-final.json', provenance)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate')
    parser.add_argument('--prepare-gate', action='store_true')
    args = parser.parse_args()
    if args.prepare_gate:
        assert args.candidate is None
        write_reports(GATE, False, [])
        print('Prepared canonical gate-pinned reports; final committed-input validation is still required.')
        return
    candidate = args.candidate
    assert candidate and re.fullmatch(r'[0-9a-f]{40}', candidate), 'Supply the full committed final SHA.'
    assert run('git', 'rev-parse', 'HEAD').decode().strip() == candidate, 'Final candidate must be current HEAD.'
    assert run('git', 'merge-base', PARENT, candidate).decode().strip() == PARENT, 'Actual parent changed.'
    assert run('git', 'merge-base', MAIN, candidate).decode().strip() == MAIN, 'Main comparison changed.'
    assert not run('git', 'status', '--porcelain'), 'Commit all candidate changes before final pin.'
    changed = run('git', 'diff', '--name-only', GATE, candidate).decode().splitlines()
    assert all(path.startswith('docs/') for path in changed), 'Only document/history changes may bridge gate inputs.'
    expected = load('reviewed-inputs-v1.json')['sha256']
    for path, value in expected.items():
        assert digest(run('git', 'show', f'{candidate}:{path}')) == value, f'Reviewed bytes changed: {path}'
        assert digest((ROOT / path).read_bytes()) == value, f'Working bytes changed: {path}'
    write_reports(candidate, True, changed)
    print(f'Bound canonical architecture evidence to {candidate}; reviewed source/test/SQL/registry/status hashes match.')


if __name__ == '__main__':
    main()
