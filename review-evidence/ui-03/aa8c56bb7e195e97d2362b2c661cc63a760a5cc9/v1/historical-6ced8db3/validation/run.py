import datetime
import json
import os
from pathlib import Path
import subprocess
import sys

folder=Path(__file__).resolve().parent
root=Path.cwd()
phase=sys.argv[1] if len(sys.argv)==2 else ''
state=json.loads((folder/'state.json').read_text())
plan=json.loads((folder/'plan.json').read_text())
def git(*args):
    return subprocess.check_output(['git',*args],text=True).strip()
def require_binding():
    if not state['rootRebound'] or not state['laneAuthorized'] or phase not in state['authorizedPhases']:
        raise SystemExit('Root must rebind the pins and authorize this phase and lane first.')
    if git('rev-parse','HEAD')!=state['candidate'] or git('branch','--show-current')!=state['branch']:
        raise SystemExit('The validation branch or candidate differs from the root binding.')
    if git('merge-base',state['parent'],'HEAD')!=state['parent']:
        raise SystemExit('The parent binding is not the actual merge base.')
    if state['dockerContext'] is None:
        raise SystemExit('Root must select the Docker context before execution.')
if phase not in plan:
    raise SystemExit('Choose functional, quality, or checker after root authorization.')
require_binding()
if git('status','--porcelain'):
    raise SystemExit('The candidate must be clean before this phase.')
if phase=='quality' and not state['qualityDespiteFunctionalHolds']:
    evidence=folder/state.get('functionalEvidenceFile',state['candidate'][:8]+'-functional.json')
    if not evidence.is_file() or any(x['exitCode']!=0 for x in json.loads(evidence.read_text())):
        raise SystemExit('Functional checks need to pass, or root must authorize quality despite their holds.')
if phase=='checker':
    for name,key in [('process','head'),('crap','head'),('review','headSha'),('snapshot','commit')]:
        report=json.loads((root/'ast-report'/(name+'.json')).read_text())
        if report[key]!=state['candidate']:
            raise SystemExit('Refresh the quality reports for the committed candidate before classification.')
    declaration=json.loads(git('show','HEAD:.pr-impact.json'))
    declaration.update(base=state['parent'],head=state['candidate'])
    (root/'ast-report'/'impact.json').write_text(json.dumps(declaration,indent=2)+'\n')
if phase=='functional':
    capture='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/capture-inputs.py'
    subprocess.run(['python3',capture,str(folder/(state['candidate'][:8]+'-source-test-inputs.json'))],check=True)
env=dict(os.environ)
env['PATH']='/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:'+env['PATH']
env['LIGHTPANDA_BIN']='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/lightpanda/1.0.0/lightpanda'
env['THERMUS_BROWSER_EVIDENCE_DIR']=str(folder/(state['candidate'][:8]+'-browser-evidence'))
env['DOCKER_CONTEXT']=state['dockerContext']
private_env='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/with-test-env.cjs'
logger='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/run-check.cjs'
results=[]
for name,command in plan[phase]:
    if name=='integration-coverage' and not state['collectIntegrationCoverage']:
        continue
    if name=='browser-51':
        capture='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/capture-inputs.py'
        current=folder/(state['candidate'][:8]+'-before-browser-inputs.json')
        subprocess.run(['python3',capture,str(current)],check=True)
        initial=json.loads((folder/(state['candidate'][:8]+'-source-test-inputs.json')).read_text())
        assert initial['files']==json.loads(current.read_text())['files']
        assert not git('status','--porcelain')
        (folder/(state['candidate'][:8]+'-browser-build-reuse.json')).write_text(json.dumps({'candidate':state['candidate'],'backendBuild':'Successful npm test build','sourceTestBuildInputsEqual':True,'ordinaryResult':str(folder/(state['candidate'][:8]+'-ordinary.log.result.json'))},indent=2)+'\n')
    command=[value.replace('{parent}',state['parent']) for value in command]
    log=folder/(state['candidate'][:8]+'-'+name+'.log')
    if log.exists():
        raise SystemExit('Preserve the prior attempt before reusing a log name: '+str(log))
    print(json.dumps({'starting':name,'candidate':state['candidate']}),flush=True)
    completed=subprocess.run(['node',private_env,'node',logger,str(log),*command],env=env)
    results.append({'name':name,'command':command,'exitCode':completed.returncode,'log':str(log)})
    (folder/(state['candidate'][:8]+'-'+phase+'.json')).write_text(json.dumps(results,indent=2)+'\n')
    require_binding()
    if name=='process':
        report=json.loads((root/'ast-report/process.json').read_text())
        assert report['head']==state['candidate'] and report['base']==state['parent']
        if any(x['status'] not in ['passed','goal miss'] for x in report['outcomes']):
            raise SystemExit('Inspect the failed or unavailable metrics stage before continuing.')
    if name=='habit-hooks' and json.loads((root/'.habit-hooks/snooze.json').read_text())!=[]:
        raise SystemExit('The habit-hooks snooze file must stay empty.')
    if completed.returncode and name!='process':
        raise SystemExit(completed.returncode)
    if name=='checker':
        text=log.read_text();start=text.find('{\n')
        report=json.loads(text[start:])
        (root/'ast-report/check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'finished':phase,'candidate':state['candidate'],'time':datetime.datetime.now(datetime.UTC).isoformat()}),flush=True)
