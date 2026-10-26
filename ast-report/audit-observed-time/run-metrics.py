import json, os, subprocess, time
from pathlib import Path
area=Path('ast-report/audit-observed-time')
commands={
 'process':['pnpm','exec','node','script/code-quality/ast-metrics-process.ts','--base','origin/main','--collect-coverage','--json','ast-report/process.json'],
 'crap':['pnpm','exec','node','script/code-quality/ast-metrics-crap.ts','--base','origin/main','--json','ast-report/crap.json'],
}
for name,command in commands.items():
 started=time.time()
 head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
 print(json.dumps({'started':name,'head':head,'command':command}),flush=True)
 with (area/(name+'.log')).open('w') as log:
  result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
 record={'head':head,'command':command,'exitCode':result.returncode,'seconds':round(time.time()-started,3)}
 (area/(name+'-run.json')).write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps(record),flush=True)
 if result.returncode not in [0,1]: raise SystemExit(result.returncode)
