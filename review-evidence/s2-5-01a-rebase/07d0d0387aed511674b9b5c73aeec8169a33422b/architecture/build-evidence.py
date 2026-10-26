from pathlib import Path
import subprocess,json,re,hashlib,sys
from PIL import Image
ROOT=Path('.cache/rebase251/architecture'); DRAFT=Path('.cache/rebase251/report-drafts')
BASE='581f30cfaa32b01399422b087b0f0bdc3b800f70'
HEAD=sys.argv[1] if len(sys.argv)>1 else 'e1e55dc04f5afa1e46eab5946067683fa496aaa6'
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(ref,path):return subprocess.check_output(['git','show',f'{ref}:{path}'])
def inventory(ref):
 text=read(ref,'architecture/components.md').decode(); lines=text.splitlines(); views=[]; title=''
 i=0
 while i<len(lines):
  if lines[i].startswith('#'):title=lines[i].lstrip('# ').strip()
  if lines[i]=='```mermaid':
   start=i+1;j=i+1
   while j<len(lines) and lines[j]!='```':j+=1
   source='\n'.join(lines[i+1:j])+'\n'
   views.append({'title':title,'start':start,'end':j+1,'sha256':sha(source.encode())})
   i=j
  i+=1
 return {'ref':ref,'path':'architecture/components.md','sha256':sha(text.encode()),'views':views}
before=inventory(BASE);after=inventory(HEAD)
assert len(before['views'])==len(after['views'])==13
assert [v['sha256'] for v in before['views']]==[v['sha256'] for v in after['views']]
for name,record in [('inventory-base.json',before),('inventory-candidate.json',after)]:ROOT.joinpath(name).write_text(json.dumps(record,indent=2)+'\n')
ranges={
 'src/accounts/organizations/organization-directory.ts':[(9,28),(88,113)],
 'src/accounts/providers/workos/workos-organizations.ts':[(58,84),(119,173),(220,277),(326,344),(399,430)],
 'src/app/hosted-workos-application.ts':[(54,55),(80,94),(128,147)],
 'src/accounts/providers/workos/workos-auth-provider.ts':[(15,28),(82,109)],
 'src/accounts/organizations/organization-administration.ts':[(66,94),(141,152)],
 'src/accounts/organizations/administration-overviews.ts':[(51,60),(75,90)],
 'src/accounts/organizations/directory-reads.ts':[(3,39)],
 'src/accounts/providers/workos/workos-signup.ts':[(110,123)],
 'docs/api-surface/src/accounts/organizations/organization-directory.d.ts':[(1,70)],
 'architecture/components.md':[(182,240),(814,932),(933,998)],
 'test/acceptance/auth/hosted-membership-deletion.test.ts':[(13,130)],
 'test/unit/auth-workos/workos-membership-reads.test.ts':[(1,52)],
 'test/unit/auth-workos/workos-organizations-deletion.test.ts':[(1,46)],
 'test/integration/auth/workos-connection.test.ts':[(17,32),(59,90),(94,142)]}
evidence=[]
for path,parts in ranges.items():
 text=read(HEAD,path).decode();lines=text.splitlines()
 assert text==read('e1e55dc04f5afa1e46eab5946067683fa496aaa6',path).decode(),f'Architecture-reviewed evidence changed: {path}'
 for first,last in parts:
  assert 1<=first<=last<=len(lines),(path,first,last,len(lines))
 evidence.append({'path':path,'ref':HEAD,'sha256':sha(text.encode()),'lines':len(lines),'ranges':[{'first':a,'last':b,'url':f'https://github.com/tomer-mayara/Thermus/blob/{HEAD}/{path}#L{a}-L{b}','excerptSha256':sha(('\n'.join(lines[a-1:b])+'\n').encode())} for a,b in parts]})
base_ranges={'src/accounts/organizations/organization-directory.ts':[(9,25),(81,104)],'src/accounts/providers/workos/workos-organizations.ts':[(58,84),(135,166),(243,255),(311,321)],'src/app/hosted-workos-application.ts':[(80,94),(128,146)],'architecture/components.md':[(182,240),(886,910)]}
for path,parts in base_ranges.items():
 text=read(BASE,path).decode();lines=text.splitlines()
 for a,b in parts:assert 1<=a<=b<=len(lines)
 evidence.append({'path':path,'ref':BASE,'sha256':sha(text.encode()),'lines':len(lines),'ranges':[{'first':a,'last':b,'url':f'https://github.com/tomer-mayara/Thermus/blob/{BASE}/{path}#L{a}-L{b}'} for a,b in parts]})
diff=subprocess.check_output(['git','diff',BASE,HEAD,'--','docs/api-surface/src/accounts/organizations/organization-directory.d.ts']).decode()
assert subprocess.check_output(['git','diff','--numstat',BASE,HEAD,'--','docs/api-surface/src/accounts/organizations/organization-directory.d.ts']).decode().startswith('6\t0\t')
ROOT.joinpath('declaration-diff.patch').write_text(diff)
source=ROOT.joinpath('comparison-v7.mmd').read_text()
summary=f'''### Architecture comparison — hosted Node server\n\nCompare candidate `{HEAD}` with trusted main merge base `{BASE}`. This is not a stack. This supplementary L3 view derives from code and registry prose; all 13 registry Mermaid views remain unchanged.\n\n```mermaid\n{source}```\n\n- Before, SDK normalization could turn missing/null management into ordinary. The shared-client raw reader now retains unknown; member revisions include management, and all current grant slugs remain available. It keeps filters, cursors and one request per membership read.\n- Before, the directory had no deletion callable. It now sends one exact membership ID. Normal void completion reports applied; only `422 / organization_membership_directory_managed` proves unsupported without effect. Other errors throw unchanged with unknown effect; retries remain zero and the request timeout remains five seconds.\n- Existing administration reads, authorization and display filtering stay at their owners. The upstream actor-name `userManagement` binding stays present; raw membership reads and optional profile reads share the same existing client. Browser routes and administration methods do not call deletion.\n- This boundary adds no admission, current-authority, last-Admin, serialization, storage or recovery rule. Later slices own those rules. Controlled-wire specifications do not supply live deletion proof; S2.5-02 remains the release hold.\n'''
ROOT.joinpath('summary-comparison.md').write_text(summary)
svg=ROOT.joinpath('comparison-v7-800.svg').read_bytes();png=ROOT.joinpath('comparison-v7-800.png').read_bytes();width,height=Image.open(ROOT/'comparison-v7-800.png').size
viewbox=[float(v) for v in re.search(rb'viewBox="([^"]+)"',svg).group(1).decode().split()]
report={'base':BASE,'head':HEAD,'candidate':HEAD,'mergeBase':BASE,'source':'comparison-v7.mmd','sourceSha256':sha(source.encode()),'svg':'comparison-v7-800.svg','svgSha256':sha(svg),'png':'comparison-v7-800.png','pngSha256':sha(png),'dimensions':[width,height],'viewBox':viewbox,'effectiveFontAt800px':18*800/viewbox[2],'renderer':'@mermaid-js/mermaid-cli 12.0.0 (existing cached installation)','sizeOption':1195,'config':'mermaid-config.json','puppeteer':'puppeteer.json','parseAndRender':'passed','visualInspection':'Passed at normal ~800px width. All title text, labels, boundaries and arrow targets are clear. Edge labels have neutral backgrounds. Runtime and source arrows remain distinct. No line crosses a node or an unrelated label. Green marks added operations inside amber existing owners.','history':'Initial -w option failed: mmdc12 uses --size. v1-v6 parse/rendered; v7 applies manager feedback by shortening labels, retaining raw GET-before-default inside workos, and leaving the external integration edge neutral. No dependencies added.','embeddedSourceByteIdentical':True,'managerReview':'Approved by manager after normal-width v7 inspection; see manager-review-final.md. Agent review does not supply required human approval.'}
ROOT.joinpath('render-report.json').write_text(json.dumps(report,indent=2)+'\n')
provenance={'base':BASE,'head':HEAD,'candidate':HEAD,'mergeBase':BASE,'comparisonScope':'PR #251 complete candidate against trusted main; not a stack','registryAll13ViewsByteIdentical':True,'declarationDelta':{'path':'src/accounts/organizations/organization-directory.ts','added':6,'removed':0},'evidence':evidence,'sourceSha256':sha(source.encode()),'testsExecutedByThisWorker':False,'publication':'Pending: local cache is not an accessible GitHub artifact','managerReview':'Approved by manager after normal-width v7 inspection; see manager-review-final.md. Agent review does not supply required human approval.'}
ROOT.joinpath('provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
ROOT.joinpath('provenance-final.json').write_text(json.dumps(provenance,indent=2)+'\n')
ROOT.joinpath('render-report-final.json').write_text(json.dumps(report,indent=2)+'\n')
ROOT.joinpath('comparison-final.mmd').write_text(source)
ROOT.joinpath('comparison-final-800.svg').write_bytes(svg)
ROOT.joinpath('comparison-final-800.png').write_bytes(png)
print(json.dumps({'base':BASE,'head':HEAD,'candidate':HEAD,'mergeBase':BASE,'views':13,'render':[width,height],'sourceSha256':sha(source.encode()),'evidenceFiles':len(evidence)},indent=2))

# Rebind prose only after verifying every source and registry hash above.
for path in [ROOT/'assessment.md',DRAFT/'quality-architecture.md',DRAFT/'main-description.md']:
 if path.exists():
  value=path.read_text()
  value=re.sub(r'\b[0-9a-f]{40}\b',lambda m: BASE if m.group(0)==BASE else HEAD,value)
  value=value.replace('e1e55dc0',HEAD[:8]).replace('Diagram v5','Diagram v7').replace('Diagram v6','Diagram v7').replace('Drafts v1–v4','Drafts v1–v6').replace('Drafts v1–v5','Drafts v1–v6').replace('with v5 improving','with v7 improving').replace('with v6 improving','with v7 improving').replace('800 × 1338','800 × 1195')
  if path.name=='main-description.md':
   front=value.split('### Architecture comparison — hosted Node server')[0]
   footer=value[value.rindex('\n---\n'):]
   value=front+summary+footer
  path.write_text(value)
