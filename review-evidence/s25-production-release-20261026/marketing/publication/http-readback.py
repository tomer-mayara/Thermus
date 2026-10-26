from pathlib import Path
import urllib.request,hashlib,json,re,html,datetime
root=Path('/Users/tomermayara/.codex/worktrees/c617/Thermus');packet=root/'docs/legal/organization-removal-2026-10-26-proposal-v1';out=Path(__file__).parent
class Redirects(urllib.request.HTTPRedirectHandler):
 def __init__(self): self.hops=[]
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  self.hops.append({'status':code,'from':req.full_url,'to':newurl});return super().redirect_request(req,fp,code,msg,headers,newurl)
def mt(s):
 s=re.sub(r'\[([^\]]+)\]\([^)]+\)',r'\1',s);s=re.sub(r'^#{1,6}\s+','',s,flags=re.M);s=re.sub(r'^[-] ','',s,flags=re.M);s=re.sub(r'^\|(?:\s*:?-+:?\s*\|)+\s*$','',s,flags=re.M)
 return ' '.join(s.replace('**','').replace('`','').replace('|',' ').split())
def vt(s):return ' '.join(html.unescape(re.sub(r'<[^>]*>','',re.sub(r'</(?:p|h[1-6]|li|tr|td|th|div|section)>',' ',s))).split())
m=json.loads((packet/'manifest.json').read_text());assert hashlib.sha256((packet/'manifest.json').read_bytes()).hexdigest()=='7528832b4e2baf055d4be35ec2d12fe3d00a9681d0a7684dc5f246e830c4071e'
results=[]
for name in ['terms','privacy']:
 source=(packet/f'{name}.md').read_bytes();md=source.decode();d=next(x for x in m['documents'] if x['file']==name+'.md');assert hashlib.sha256(source).hexdigest()==d['sha256'] and len(source)==d['utf8_bytes']
 for slash in ['', '/']:
  url=f'https://thermus.ai/{name}{slash}';redirects=Redirects();opener=urllib.request.build_opener(redirects);req=urllib.request.Request(url,headers={'User-Agent':'Thermus-Release-Readback/1.0 (approved-policy-publication)'})
  with opener.open(req,timeout=30) as r:
   raw=r.read();page=raw.decode();(out/f'{name}{"-slash" if slash else "-direct"}.html').write_bytes(raw)
   c=re.search(r'<div class="legal-content"[^>]*>([\s\S]*?)</div>',page).group(1);heading=re.search(r'<h1[^>]*>([\s\S]*?)</h1>',page).group(1)
   expected=re.findall(r'\[([^\]]+)\]\(([^)]+)\)',md);actual=[(vt(label),html.unescape(target)) for target,label in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>',c)];cursor=0
   for item in expected:cursor=actual.index(item,cursor)+1
   unexpected=[pair for pair in actual if pair not in expected and not(pair[0] in md and pair[1] in [pair[0],'https://'+pair[0],'mailto:'+pair[0]])]
   erows=[[mt(cell) for cell in line[1:-1].split('|')] for line in md.splitlines() if line.startswith('|') and not re.match(r'^\|(?:\s*:?-+:?\s*\|)+\s*$',line)]
   arows=[[vt(cell) for cell in re.findall(r'<t[hd][^>]*>([\s\S]*?)</t[hd]>',row)] for row in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>',c)]
   ids=set(re.findall(r'\bid="([^"]+)"',page));anchors=re.findall(r'href="#([^"]+)"',page)
   facts={'document':name,'requested':url,'final_url':r.url,'redirects':redirects.hops,'status':r.status,'content_type':r.headers.get('Content-Type'),'server':r.headers.get('Server'),'html_bytes':len(raw),'html_sha256':hashlib.sha256(raw).hexdigest(),'source_bytes':len(source),'source_sha256':d['sha256'],'version':re.search(r'data-document-version="([^"]+)"',page).group(1),'hash_attribute':re.search(r'data-document-sha256="([^"]+)"',page).group(1),'complete_text_equals_source':vt(heading+' '+c)==mt(md),'source_links':len(expected),'all_links_ordered':True,'unexpected_links':unexpected,'all_table_cells_equal':erows==arows,'table_rows':len(arows),'all_anchors_resolve':all(x in ids for x in anchors),'anchor_count':len(anchors),'h1_count':len(re.findall(r'<h1\b',page)),'direct_mailto':'href="mailto:legal@thermus.ai"' in c,'cfemail_absent':'data-cfemail' not in page,'effective_date':'Effective date: 26 October 2026.' in page,'footer_links':[html.unescape(x) for x in re.findall(r'<a\b[^>]*href="([^"]+)"',re.search(r'<footer\b[^>]*>([\s\S]*?)</footer>',page).group(1))]}
   assert r.status==200 and r.url==f'https://thermus.ai/{name}/';assert facts['version']==d['version'] and facts['hash_attribute']==d['sha256'];assert facts['complete_text_equals_source'] and not unexpected and facts['all_table_cells_equal'] and facts['all_anchors_resolve'] and facts['h1_count']==1 and facts['direct_mailto'] and facts['cfemail_absent'] and facts['effective_date'];assert facts['footer_links']==['/','/privacy','/terms'];results.append(facts)
(out/'http-readback.json').write_text(json.dumps({'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Public HTTP; HTML transformation compared separately from exact approved Markdown bytes','results':results},indent=2)+'\n')
print(json.dumps(results,indent=2))
