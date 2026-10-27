import datetime, json, os, pathlib, subprocess, time
root=pathlib.Path.cwd()
out=root/'.cache/ui-stack-finish/ui01'
prior=pathlib.Path('/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04')
os.environ['PATH']='/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:'+os.environ['PATH']
os.environ['LIGHTPANDA_BIN']='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/lightpanda/1.0.0/lightpanda'
os.environ['THERMUS_BROWSER_EVIDENCE_DIR']=str(out/'browser-evidence')
while not (out/'npm-test.log.result.json').exists():
    time.sleep(2)
initial=json.loads((out/'npm-test.log.result.json').read_text())
if initial['exitCode']:
    print(json.dumps({'stopped':'npm test failed','result':initial}),flush=True)
    raise SystemExit(1)
checks=[
 ('typecheck',['npm','run','typecheck']),
 ('portal-build',['npm','run','build:user-portal']),
 ('members-browser-build',['npm','run','build']),
 ('members-browser',['node','--test','dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js']),
 ('self-hosted-container',['npm','run','test:container']),
 ('hosted-offline',['npm','run','build:hosted']),
 ('hosted-amd64-image',['npm','run','test:container:hosted']),
 ('habit-hooks',['habit-hooks','--branch','origin/main']),
]
for name,command in checks:
 print(json.dumps({'starting':name,'time':datetime.datetime.now(datetime.UTC).isoformat()}),flush=True)
 result=subprocess.run(['node',str(prior/'run-check.cjs'),str(out/(name+'.log')),*command])
 print(json.dumps({'finished':name,'exitCode':result.returncode}),flush=True)
print(json.dumps({'gates-finished':True}),flush=True)
