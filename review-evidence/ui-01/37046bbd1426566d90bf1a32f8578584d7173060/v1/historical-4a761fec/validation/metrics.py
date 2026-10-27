import datetime,json,os,pathlib,subprocess
out=pathlib.Path('.cache/ui-stack-finish/ui01')
prior=pathlib.Path('/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04')
os.environ['PATH']='/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:'+os.environ['PATH']
os.environ['LIGHTPANDA_BIN']='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/lightpanda/1.0.0/lightpanda'
prefix=['pnpm','--config.verifyDepsBeforeRun=false','exec','node']
checks=[
 ('coverage',prefix+['script/code-quality/ast-metrics-coverage.ts','--suite','integration']),
 ('snapshot-base',prefix+['script/code-quality/ast-metrics-snapshot.ts','--base','2b3ad13b9e2e61e206479b82e91359192cae1d00']),
 ('snapshot-head',prefix+['script/code-quality/ast-metrics-snapshot.ts']),
 ('process',prefix+['script/code-quality/ast-metrics-process.ts','--base','2b3ad13b9e2e61e206479b82e91359192cae1d00','--json','ast-report/process.json']),
 ('crap',prefix+['script/code-quality/ast-metrics-crap.ts','--base','2b3ad13b9e2e61e206479b82e91359192cae1d00','--json','ast-report/crap.json']),
]
for name,command in checks:
 print(json.dumps({'starting':name,'time':datetime.datetime.now(datetime.UTC).isoformat()}),flush=True)
 result=subprocess.run(['node',str(prior/'run-check.cjs'),str(out/(name+'.log')),*command])
 print(json.dumps({'finished':name,'exitCode':result.returncode}),flush=True)
 if result.returncode and name not in ['process','crap']:
  raise SystemExit(result.returncode)
print(json.dumps({'metrics-finished':True}),flush=True)
