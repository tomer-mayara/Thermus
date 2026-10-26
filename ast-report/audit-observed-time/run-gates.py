import json, os, subprocess, sys, time
from pathlib import Path
root=Path.cwd()
out=root/'ast-report/audit-observed-time'
out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ, LIGHTPANDA_BIN='/Users/tomermayara/.codex/worktrees/logs-restack/Thermus/.cache/lightpanda/1.0.0/lightpanda')
commands={
 'ordinary':['npm','test'],
 'typecheck':['npm','run','typecheck'],
 'portal-build':['npm','run','build:user-portal'],
 'api-surface':['pnpm','exec','node','script/pr-review/api-surface.ts','--check'],
 'self-hosted':['npm','run','test:container'],
 'hosted-image':['npm','run','test:container:hosted'],
 'hosted-build':['npm','run','build:hosted'],
 'collector':['npm','run','test:logging:collector'],
 'coverage':['pnpm','exec','node','script/code-quality/ast-metrics-coverage.ts','--suite','unit','--suite','integration'],
 'hosted-live':['node','/Users/tomermayara/.config/thermus/with-workos-staging.cjs','npm','run','test:hosted-live'],
}
for name in sys.argv[1:]:
 command=commands[name]
 step_env=dict(env)
 if name=='self-hosted': step_env['THERMUS_CONTAINER_GATE']='1'
 started=time.time()
 head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
 print(json.dumps({'started':name,'head':head,'command':command}),flush=True)
 with (out/(name+'.log')).open('w') as log:
  result=subprocess.run(command,env=step_env,stdout=log,stderr=subprocess.STDOUT)
 record={'command':command,'head':head,'exitCode':result.returncode,'seconds':round(time.time()-started,3),'log':name+'.log'}
 (out/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps(record),flush=True)
 if result.returncode: sys.exit(result.returncode)
