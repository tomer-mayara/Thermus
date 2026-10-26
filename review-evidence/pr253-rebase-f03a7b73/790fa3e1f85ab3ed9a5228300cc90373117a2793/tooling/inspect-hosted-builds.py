"""Read current PR 253 Docker progress logs and print observed hosted-build evidence."""
from pathlib import Path
import hashlib
import json
import re
import sys
from datetime import datetime, timezone

ROOT = Path.cwd().resolve()
CACHE = ROOT / '.cache/pr253-rebase-f03a7b73'
HEAD = 'fa5d4d7f57ef270df2a056ad523ec22e3b5032b6'
PARENT = 'f03a7b73b2c27dc26477d5378a3356f28744a367'
MAIN = '8c6d204e8588a664438ba8934ab36670b802525f'
PHASES = ['emitted unit', 'portal unit', 'portal acceptance', 'emitted integration', 'explicit hosted acceptance/interface selection', 'local renderer runtime']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def option(args, name):
    if name in args:
        offset = args.index(name) + 1
        return args[offset] if offset < len(args) else None
    return next((value[len(name) + 1:] for value in args if value.startswith(name + '=')), None)


def inspect(path):
    before = path.stat()
    data = path.read_bytes()
    after = path.stat()
    lines = data.decode('utf8', errors='replace').splitlines()
    header = json.loads(lines[0]) if lines else {}
    args = header.get('args', [])
    dockerfile = option(args, '--file') or option(args, '-f')
    if not dockerfile or Path(dockerfile).name != 'Dockerfile.hosted':
        return None
    footer = None
    for line in reversed(lines[1:]):
        if line.startswith('{'):
            try:
                value = json.loads(line)
                if 'finished' in value and 'code' in value:
                    footer = value
                    break
            except json.JSONDecodeError:
                pass
    step_ids = set()
    for line in lines:
        match = re.match(r'^#(\d+) \[.*\] RUN --network=none npm run build:hosted\s*$', line)
        if match:
            step_ids.add(match.group(1))
    counts = []
    active = {}
    done = set()
    cached = set()
    commands = []
    for line in lines:
        match = re.match(r'^#(\d+) (.*)$', line)
        if not match or match.group(1) not in step_ids:
            continue
        step, content = match.groups()
        if content.startswith('DONE '):
            done.add(step)
        if content == 'CACHED':
            cached.add(step)
        output = re.sub(r'^\d+(?:\.\d+)?\s+', '', content)
        if output.startswith('> '):
            commands.append({'step': step, 'command': output[2:]})
        count = re.match(r'^(?:ℹ|#) (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) (\d+(?:\.\d+)?)$', output)
        if count:
            key, value = count.groups()
            if key == 'tests' and active:
                counts.append(active)
                active = {}
            active[key] = float(value) if '.' in value else int(value)
            if key == 'duration_ms':
                counts.append(active)
                active = {}
    if active:
        counts.append(active)
    stable = (before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns)
    complete_counts = len(counts) == len(PHASES) and all(set(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) <= row.keys() for row in counts)
    count_passes = complete_counts and all(row['tests'] > 0 and row['pass'] == row['tests'] and all(row[key] == 0 for key in ['fail', 'cancelled', 'skipped', 'todo']) for row in counts)
    fresh_checks = bool(step_ids) and step_ids <= done and not cached and complete_counts
    platform = option(args, '--platform')
    context = header.get('context')
    observed_pass = stable and footer is not None and footer.get('code') == 0 and footer.get('signal') is None and platform == 'linux/amd64' and context == 'colima-thermus-pr253' and fresh_checks and count_passes
    return {
        'log': path.name, 'sha256': digest(data), 'bytes': len(data), 'stableWhileRead': stable,
        'command': header.get('command'), 'args': args, 'dockerContext': context,
        'started': header.get('started'), 'completion': footer,
        'platformFromActualInvocation': platform,
        'networkNoneBuildHostedStepIds': sorted(step_ids), 'completedStepIds': sorted(done), 'cachedStepIds': sorted(cached),
        'observedNpmCommands': commands,
        'phaseCounts': [{'phase': PHASES[index] if len(counts) == len(PHASES) else 'unmapped summary ' + str(index + 1), **row} for index, row in enumerate(counts)],
        'phaseMappingBasis': 'Current package.json build:hosted/check/test:unit command order; names are inferred from that order only when all six summaries are present.',
        'freshChecksExecuted': fresh_checks, 'allRequiredCountsPassWithoutSkips': count_passes,
        'observedHostedOfflinePass': observed_pass,
        'status': 'observed pass; manager review still required' if observed_pass else 'incomplete, failed, cached, or provenance not established; inspect fields and original log',
    }


def main():
    paths = [Path(value).resolve() for value in sys.argv[1:]] if sys.argv[1:] else sorted(CACHE.glob('docker-build-*.log'))
    for path in paths:
        assert path.parent == CACHE and re.fullmatch(r'docker-build-\d+-\d+\.log', path.name), 'Read only current task Docker logs.'
    reports = []
    errors = []
    for path in paths:
        try:
            report = inspect(path)
            if report is not None:
                reports.append(report)
        except (OSError, ValueError, IndexError) as error:
            errors.append({'log': path.name, 'errorType': type(error).__name__})
    print(json.dumps({
        'observedAt': datetime.now(timezone.utc).isoformat(), 'candidate': HEAD, 'mergeBase': PARENT, 'main': MAIN,
        'scope': 'Read-only observation of actual full Docker progress. This does not run a gate, approve a report, or establish hosted runtime-container success.',
        'packageSha256': digest((ROOT / 'package.json').read_bytes()), 'dockerfileSha256': digest((ROOT / 'Dockerfile.hosted').read_bytes()),
        'hostedBuildLogsFound': len(reports), 'logs': reports, 'parseErrors': errors,
    }, indent=2))


if __name__ == '__main__':
    main()
