import ts from '/Users/tomermayara/.codex/worktrees/c617/Thermus/.habit-hooks/node_modules/typescript/lib/typescript.js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd();
const head = 'e46c506811b8639f691304c423f4af5fe894955e';
const base = '8c6d204e8588a664438ba8934ab36670b802525f';
const focused = execFileSync('git', ['ls-files', 'test/unit'], { encoding: 'utf8' }).trim().split('\n').filter(path => path.endsWith('.test.ts'));
const visited = new Set(), edges = [], unresolved = [], dynamic = [], queue = [...focused];
function resolveModule(from, spec) {
  if (!spec.startsWith('.')) return;
  const raw = resolve(dirname(resolve(root, from)), spec);
  return [raw, raw.replace(/\.js$/, '.ts'), raw + '.ts', raw + '.tsx', resolve(raw, 'index.ts')].find(path => existsSync(path) && /\.(?:ts|tsx|mts)$/.test(path));
}
function typeOnly(node) {
  return node.isTypeOnly === true || (node.importClause && (node.importClause.isTypeOnly || (node.importClause.name === undefined && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every(each => each.isTypeOnly))));
}
for (let i = 0; i < queue.length; i++) {
  const path = queue[i];
  if (visited.has(path)) continue;
  visited.add(path);
  const content = readFileSync(path, 'utf8'), source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  function follow(spec, kind) {
    const target = resolveModule(path, spec);
    if (target) { const to = relative(root, target); edges.push({ from: path, to, kind }); queue.push(to); }
    else if (spec.startsWith('.')) unresolved.push({ from: path, spec, kind });
  }
  function walk(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !typeOnly(node)) follow(node.moduleSpecifier.text, 'module');
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteralLike(arg)) follow(arg.text, 'dynamic');
      else dynamic.push({ from: path, text: node.getText(source) });
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
}
const listeners = [], fixedMentions = [], childCalls = [];
for (const path of visited) for (const [index, line] of readFileSync(path, 'utf8').split('\n').entries()) {
  if (/\.listen\(|startHttpServer\(/.test(line)) listeners.push({ path, line: index + 1, text: line.trim() });
  if (/46443|46480|46481/.test(line)) fixedMentions.push({ path, line: index + 1, text: line.trim() });
  if (/\b(?:spawn|execFile|fork)\(/.test(line)) childCalls.push({ path, line: index + 1, text: line.trim() });
}
const forbiddenReach = [...visited].filter(path => path === 'test/support/hosted-live/local-https-site.ts' || path.includes('fetch-public-connect-proof') || path.includes('fetch-public-script-proof'));
const result = { recorded: new Date().toISOString(), head, base, parserVersion: ts.version, parserNote: 'Read-only full selected unit root runtime import trace using installed TypeScript6 AST; type-only edges excluded. No test or server starts.', focusedFiles: focused, focusedCount: focused.length, runtimeReachableFiles: [...visited].sort(), runtimeModuleEdges: edges, unresolvedRelativeImports: unresolved, nonLiteralDynamicImports: dynamic, fixedLiveHelperReach: forbiddenReach, listenerSites: listeners, fixedPortMentions: fixedMentions, childProcessCalls: childCalls, files: Object.fromEntries([...visited].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])) };
writeFileSync('.cache/pr257-quality/fresh-unit/unit-port-analysis.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ focusedFiles: focused.length, runtimeFiles: visited.size, unresolved, dynamic, fixedLiveHelperReach: forbiddenReach, listenerSites: listeners, fixedPortMentions: fixedMentions, childProcessCalls: childCalls }, null, 2));
