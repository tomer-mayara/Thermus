const {spawn}=require('node:child_process');
const path=require('node:path');
const runner='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/run-check.cjs';
const envWrapper='/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/ui04/with-test-env.cjs';
const out=path.resolve('.cache/ui-stack-finish/ui02');
const steps=[
 ['typecheck',['npm','run','typecheck']],
 ['portal-build',['npm','run','build:user-portal']],
 ['members-browser',['node','--test','dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js']],
 ['self-hosted-container',['npm','run','test:container']],
 ['hosted-offline',['npm','run','build:hosted']],
];
async function run(name,args){
 console.log('Starting '+name);
 const code=await new Promise((resolve,reject)=>{const c=spawn('node',[runner,path.join(out,name+'-final.log'),'node',envWrapper,...args],{stdio:'inherit',env:{...process.env,THERMUS_BROWSER_EVIDENCE_DIR:path.join(out,'screenshots-final')}});c.on('error',reject);c.on('exit',resolve);});
 if(code!==0)throw new Error(name+' failed with '+code+'; paused without retry.');
}
(async()=>{for(const [n,a]of steps)await run(n,a);})().catch(e=>{console.error(e.message);process.exitCode=1;});
