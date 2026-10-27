import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

folder=Path(__file__).resolve().parent
root=Path.cwd()
state=json.loads((folder/'state.json').read_text())
plan=json.loads((folder/'plan.json').read_text())
phase=sys.argv[1] if len(sys.argv)==2 else ''
def git(*args):
    return subprocess.check_output(['git',*args],text=True).strip()
def binding():
    if not state['rootRebound'] or not state['laneAuthorized'] or phase not in state['authorizedPhases']:
        raise SystemExit('Root must rebind the pins and release the lane before this phase.')
    if git('rev-parse','HEAD')!=state['candidate'] or git('branch','--show-current')!=state['branch']:
        raise SystemExit('Candidate or stable branch differs from the root binding.')
    if git('merge-base',state['base'],'HEAD')!=state['base']:
        raise SystemExit('The base is not the actual merge base.')
if phase not in plan:
    raise SystemExit('Choose refresh, quality, or checker after root authorization.')
binding()
if git('status','--porcelain'):
    raise SystemExit('Commit and rebind the candidate before this phase.')
if phase=='checker':
    for name,key in [('process','head'),('review','headSha'),('crap','head'),('snapshot','commit')]:
        report=json.loads((root/'ast-report'/(name+'.json')).read_text())
        if report[key]!=state['candidate']:
            raise SystemExit('Quality reports must name the committed current candidate.')
    declaration=json.loads(git('show','HEAD:.pr-impact.json'))
    declaration.update(base=state['base'],head=state['candidate'])
    (root/'ast-report/impact.json').write_text(json.dumps(declaration,indent=2)+'\n')
env=dict(os.environ)
env['PATH']='/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:'+env['PATH']
env['LIGHTPANDA_BIN']='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/lightpanda/1.0.0/lightpanda'
env['DOCKER_CONTEXT']=state['dockerContext']
private_env='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/with-test-env.cjs'
logger='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/run-check.cjs'
results=[]
for name,command in plan[phase]:
    command=[x.replace('{base}',state['base']) for x in command]
    log=folder/(state['candidate'][:8]+'-'+name+'.log')
    if log.exists():
        raise SystemExit('Archive the prior attempt before reusing '+str(log))
    print(json.dumps({'starting':name,'candidate':state['candidate']}),flush=True)
    completed=subprocess.run(['node',private_env,'node',logger,str(log),*command],env=env)
    results.append({'name':name,'command':command,'exitCode':completed.returncode,'log':str(log)})
    (folder/(state['candidate'][:8]+'-'+phase+'.json')).write_text(json.dumps(results,indent=2)+'\n')
    binding()
    if name=='process':
        report=json.loads((root/'ast-report/process.json').read_text())
        assert report['head']==state['candidate'] and report['base']==state['base']
        if any(x['status'] not in ['passed','goal miss'] for x in report['outcomes']):
            raise SystemExit('Inspect the failed or unavailable metrics stage before continuing.')
    records=[line[3:] for line in git('status','--porcelain').splitlines() if line.startswith('?? docs/metrics/')]
    if records:
        record={'candidate':state['candidate'],'base':state['base'],'stage':name,'records':[{'path':x,'sha256':hashlib.sha256((root/x).read_bytes()).hexdigest()} for x in records]}
        (folder/(state['candidate'][:8]+'-history-pause.json')).write_text(json.dumps(record,indent=2)+'\n')
        raise SystemExit('Pause for root to commit the immutable history record and rebind the stack.')
    if name=='habit-hooks' and json.loads((root/'.habit-hooks/snooze.json').read_text())!=[]:
        raise SystemExit('The snooze file must remain empty.')
    if name=='checker':
        text=log.read_text();start=text.find('{\n')
        (root/'ast-report/check.json').write_text(json.dumps(json.loads(text[start:]),indent=2)+'\n')
    if completed.returncode and name!='process':
        raise SystemExit(completed.returncode)
print(json.dumps({'finished':phase,'candidate':state['candidate'],'time':datetime.datetime.now(datetime.UTC).isoformat()}),flush=True)
