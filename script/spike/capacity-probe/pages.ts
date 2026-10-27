// The controlled pages of the RHD-05 capacity protocol, served again by a disposable pages origin. The origin runs
// one line of JavaScript with node -e in a public Node image: it builds both pages in memory at its start and serves
// them with /healthz. The pages hold generated words only, no real content.

export type PageName = 'page9m' | 'js';

export interface PageSpec {
  readonly path: string;
  readonly bytes: number;
  readonly marker: string;
  // The near-limit marker is plain text. The JavaScript marker appears only after its script runs.
  readonly markerInHtml: boolean;
}

const NEAR_JSON_BYTES = 9 * 1024 * 1024;
const NEAR_HEAD = '<!doctype html><html lang=en><head><meta charset=utf-8><title>Near-limit probe page</title></head><body><main>'
  + '<h1>Near-limit probe page</h1><p>Near-limit page marker 7319</p><p>The script below holds inert hydration input.</p>'
  + '</main><script id=hydration type=application/json>';
const NEAR_TAIL = '</script></body></html>';
const JS_MARKER = 'JavaScript page marker 2741';
const JS_BYTES = 14_845;
const JS_HEAD = '<!doctype html><html lang=en><head><meta charset=utf-8><title>Representative probe page</title></head><body><main>'
  + '<h1>Representative probe page</h1>';
const JS_TAIL = `</main><script>var p=document.createElement(String.fromCharCode(112));p.textContent=String.fromCharCode(${charCodes(JS_MARKER)});`
  + 'document.querySelector(String.fromCharCode(109,97,105,110)).appendChild(p)</script></body></html>';

export const PAGES: Readonly<Record<PageName, PageSpec>> = {
  page9m: { path: '/page9m', bytes: NEAR_HEAD.length + NEAR_JSON_BYTES + NEAR_TAIL.length, marker: 'Near-limit page marker 7319', markerInHtml: true },
  js: { path: '/js', bytes: JS_BYTES, marker: JS_MARKER, markerInHtml: false },
};

// The pages image: node:24-slim (24-bookworm-slim), the linux/amd64 manifest of the index
// sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205, created on 21 October 2026.
export const PAGES_IMAGE = 'docker.io/library/node@sha256:2dd9a4f758e173b65fee15388f7706af6fb01ef50cf7a2c0538711d67a6981ae';

function charCodes(text: string): string {
  return [...text].map((character) => character.charCodeAt(0)).join(',');
}

// A string literal of the program. The text must need no escape, so JSON.stringify gives it in plain double quotes.
function literal(text: string): string {
  const quoted = JSON.stringify(text);
  if (quoted.slice(1, -1) !== text || text.includes('"')) throw new Error('A page fragment needs an escape.');
  return quoted;
}

// The JSON array holds small records, then one filler record that makes it exactly NEAR_JSON_BYTES long.
function nearPageFunction(): string {
  return [
    `function nearPage(){const target=${NEAR_JSON_BYTES};const items=[];let size=2;`,
    'for(let i=0;;i++){const item=JSON.stringify({id:i,name:"probe item "+i,tags:["capacity","probe"],ready:true});',
    'const add=item.length+(items.length>0?1:0);if(size+add+64>target)break;items.push(item);size+=add;}',
    'const empty=JSON.stringify({fill:""});items.push(JSON.stringify({fill:"x".repeat(target-size-1-empty.length)}));',
    `return ${literal(NEAR_HEAD)}+"["+items.join(",")+"]"+${literal(NEAR_TAIL)};}`,
  ].join('');
}

// Paragraphs of generated sentences, then one padding paragraph that makes the page exactly JS_BYTES long.
function jsPageFunction(): string {
  return [
    `function jsPage(){const head=${literal(JS_HEAD)};const tail=${literal(JS_TAIL)};let body="";`,
    `for(let i=1;head.length+body.length+tail.length+200<${JS_BYTES};i++){`,
    'body+="<p>Probe sentence "+i+" of the representative page has plain generated words and no real content.</p>";}',
    `const fixed=head.length+body.length+tail.length+7;return head+body+"<p>"+"w".repeat(${JS_BYTES}-fixed)+"</p>"+tail;}`,
  ].join('');
}

function serverStatements(): string {
  return [
    `const pages={${literal(PAGES.page9m.path)}:nearPage(),${literal(PAGES.js.path)}:jsPage()};`,
    'require("http").createServer((request,response)=>{const path=(request.url||"/").split("?")[0];',
    'if(path==="/healthz"){response.writeHead(200,{"content-type":"text/plain"});response.end("ok");return;}',
    'const page=pages[path];if(page===undefined){response.writeHead(404,{"content-type":"text/plain"});response.end("not found");return;}',
    'response.writeHead(200,{"content-type":"text/html; charset=utf-8","content-length":Buffer.byteLength(page),"cache-control":"no-store"});',
    'response.end(page);}).listen(Number(process.env.PORT||10000),"0.0.0.0");',
  ].join('');
}

// One line with no single quote, backslash, dollar sign, or backtick, as the SO-01d part two job program: a shell
// and a shell-style word split give the same arguments.
function pagesProgram(): string {
  const program = `${nearPageFunction()}${jsPageFunction()}${serverStatements()}`;
  if (/['\\$`\n]/.test(program)) throw new Error('The pages program must not contain a quote, backslash, dollar sign, backtick, or new line.');
  return program;
}

export function pagesCommand(): string {
  return `node -e '${pagesProgram()}'`;
}
