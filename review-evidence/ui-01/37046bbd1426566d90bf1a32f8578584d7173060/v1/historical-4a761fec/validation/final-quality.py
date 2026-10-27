import json,os,pathlib,subprocess
p=pathlib.Path('.cache/ui-stack-finish/ui01')
runner='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/run-check.cjs'
os.environ['PATH']='/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:'+os.environ['PATH']
os.environ['LIGHTPANDA_BIN']='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/lightpanda/1.0.0/lightpanda'
base='2b3ad13b9e2e61e206479b82e91359192cae1d00'
prefix=['pnpm','--config.verifyDepsBeforeRun=false','exec','node']
checks=[('snapshot-head',prefix+['script/code-quality/ast-metrics-snapshot.ts']),('process',prefix+['script/code-quality/ast-metrics-process.ts','--base',base,'--json','ast-report/process.json']),('crap',prefix+['script/code-quality/ast-metrics-crap.ts','--base',base,'--json','ast-report/crap.json']),('api',prefix+['script/pr-review/api-surface.ts','--check']),('habit-hooks',['habit-hooks','--branch',base])]
for name,command in checks:
 print(json.dumps({'starting':'4a761fec-'+name}),flush=True)
 result=subprocess.run(['node',runner,str(p/('4a761fec-'+name+'.log')),*command])
 print(json.dumps({'finished':name,'exitCode':result.returncode}),flush=True)
 if result.returncode and name not in ['process']:
  raise SystemExit(result.returncode)
print(json.dumps({'final-quality-finished':True}),flush=True)
