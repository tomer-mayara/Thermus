import { readFileSync } from 'node:fs';
import { posix, relative } from 'node:path';
import { parse } from 'yaml';
import { componentDefinitionsOf, componentOf } from '../script/component-ownership.ts';
import { allowsEdge, graphRulesOf } from '../script/pr-review/rules-graph.ts';
import { externalNameOf } from '../script/pr-review/external.ts';

const policy = parse(readFileSync(new URL('../docs/implementation/pr-review-rules.yaml', import.meta.url), 'utf8'));
const definitions = componentDefinitionsOf(policy.dependency_graph.components, 'ESLint component roots');
const graph = graphRulesOf(policy, 'ESLint component rules');
const publicModules = new Set([
  ...policy.public_surface.external,
  ...Object.values(policy.public_surface.between_packages).flat(),
  ...policy.public_surface.documented,
]);
const portalConfigs = new Set(definitions['user-portal'].roots.map((root) => `${root}vite.config.ts`));
const workosTypes = {
  'workos-browser-session.ts': new Set(['WorkOSBrowserSession', 'WorkOSSignedInSession']),
  'workos-signup.ts': new Set(['SignupActivation', 'SignupDocuments', 'SignupResult']),
};
const workosHelpers = {
  'session-cookies.ts': new Set(['sameSecret']),
  'workos-signup-documents.ts': new Set(['validateSignupDocuments']),
};

function specifierOf(node) {
  const source = node.source ?? node.argument;
  if (typeof source?.value === 'string') return source.value;
  if (typeof source?.literal?.value === 'string') return source.literal.value;
  if (source?.type === 'TemplateLiteral' && source.expressions.length === 0) return source.quasis[0].value.cooked;
  return undefined;
}

function importedNames(node) {
  if (node.type === 'TSImportType') return node.qualifier?.type === 'Identifier' ? [node.qualifier.name] : [];
  return (node.specifiers ?? []).map((entry) => {
    if (entry.type === 'ImportSpecifier') return entry.imported.name ?? entry.imported.value;
    if (entry.type === 'ExportSpecifier') return entry.local.name ?? entry.local.value;
    return undefined;
  });
}

function typeOnly(node, file) {
  return /\.d\.[cm]?ts$/.test(file) || node.type === 'TSImportType' || node.importKind === 'type' || node.exportKind === 'type';
}

function workosAccess(file, target, node) {
  if (!file.startsWith('src/interfaces/web/auth/workos/') || !publicModules.has(target)) return false;
  const names = importedNames(node);
  const permitted = typeOnly(node, file) ? workosTypes[posix.basename(target)] : workosHelpers[posix.basename(target)];
  return names.length > 0 && permitted !== undefined && names.every((name) => permitted.has(name));
}

function portalAccess(file, target, owner) {
  if (portalConfigs.has(file) || /\.d\.[cm]?ts$/.test(file)) return true;
  return owner === 'user-portal' && !target.endsWith('/vite.config.ts') && !/\.d\.[cm]?ts$/.test(target);
}

function pipelineProviderAccess(owner, target, targetOwner) {
  const name = posix.basename(target);
  if (['page-fetch', 'search'].includes(owner) && targetOwner === 'execution') {
    return ['execution-context.ts', 'pipeline-step.ts', 'step-record.ts'].includes(name);
  }
  if (['page-fetch', 'search', 'execution', 'html-processing', 'search-engine'].includes(owner) && targetOwner === 'website-fetcher') {
    return name === 'website-fetcher.ts' || (['page-fetch', 'search'].includes(owner) && name === 'renderer-failure-reports.ts');
  }
  return true;
}

function publicEdgeAccess(owner, target, edge) {
  if (edge.to === undefined) return false;
  if (graph.forbiddenEdges.some((entry) => entry.from === owner && entry.to.includes(edge.to))) return false;
  return allowsEdge(graph.allowedEdges, edge) && (owner === 'app' || publicModules.has(target));
}

function fileContextAccess(file, target, { node, owner, targetOwner }) {
  if (owner === 'user-portal') return portalAccess(file, target, targetOwner);
  if (owner === 'web' && ['workos', 'better-auth'].includes(targetOwner)) return targetOwner === 'workos' && workosAccess(file, target, node);
  return true;
}

function internalAccess(file, target, { node, owner }) {
  const targetOwner = componentOf(target, definitions);
  if (!fileContextAccess(file, target, { node, owner, targetOwner })) return false;
  if (targetOwner === owner) return true;
  if (!pipelineProviderAccess(owner, target, targetOwner)) return false;
  return publicEdgeAccess(owner, target, { from: owner, to: targetOwner, kind: typeOnly(node, file) ? 'type' : 'runtime' });
}

function externalAccess(file, specifier, owner) {
  if (owner === 'user-portal' && !portalConfigs.has(file) && !/\.d\.[cm]?ts$/.test(file)) return false;
  const external = externalNameOf(specifier);
  return (external.builtin ? graph.nodeBuiltins : graph.externalImports).get(owner)?.includes(external.name) ?? false;
}

export const importContext = {
  meta: { type: 'problem', schema: [], messages: { forbidden: 'This import is outside the permitted component or execution-context boundary.' } },
  create(context) {
    const file = relative(process.cwd(), context.filename).split('\\').join('/');
    const owner = componentOf(file, definitions);
    if (owner === undefined) return {};
    const check = (node) => {
      if (node.type === 'ExportNamedDeclaration' && node.source === null) return;
      const specifier = specifierOf(node);
      const target = specifier?.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), specifier)).replace(/\.js$/, '.ts') : undefined;
      const allowed = specifier !== undefined && (target === undefined ? externalAccess(file, specifier, owner) : internalAccess(file, target, { node, owner }));
      if (!allowed) context.report({ node, messageId: 'forbidden' });
    };
    return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check, ImportExpression: check, TSImportType: check };
  },
};
