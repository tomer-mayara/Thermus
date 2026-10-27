const {spawn,execFileSync}=require('node:child_process');const path=require('node:path');
const runner='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/run-check.cjs';
const envWrapper='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/with-test-env.cjs';const out=path.resolve('.cache/ui-stack-finish/ui02');
const head='8278873552601ed156a9aaeeb31c41cdb84ad77a';const base='4a761fecf5ed1719959d286f104ecd3884068478';
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==head)throw Error('Unexpected HEAD');
const steps=[
 ['integration-coverage',['pnpm','exec','node','script/code-quality/ast-metrics-coverage.ts','--suite','integration'],false],
 ['snapshot-base',['pnpm','exec','node','script/code-quality/ast-metrics-snapshot.ts','--base',base],false],
 ['snapshot-head',['pnpm','exec','node','script/code-quality/ast-metrics-snapshot.ts'],false],
 ['metrics-process',['pnpm','exec','node','script/code-quality/ast-metrics-process.ts','--base',base,'--json','ast-report/process.json'],true],
 ['metrics-crap',['pnpm','exec','node','script/code-quality/ast-metrics-crap.ts','--base',base,'--json','ast-report/crap.json'],true],
 ['api-surface',['pnpm','exec','node','script/pr-review/api-surface.ts','--check'],false],
 ['habit-hooks',['habit-hooks','--branch',base],false],
];
async function run(name,args,allowMiss){console.log('Starting '+name);const code=await new Promise((resolve,reject)=>{const child=spawn('node',[runner,path.join(out,name+'-final.log'),'node',envWrapper,...args],{stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',resolve)});if(code!==0&&!allowMiss)throw Error(name+' failed with '+code+'; paused without retry.');}
(async()=>{for(const [n,a,m]of steps)await run(n,a,m);console.log('Review metrics, gitstatus and new immutable records before checker.');})().catch(e=>{console.error(e.message);process.exitCode=1;});
