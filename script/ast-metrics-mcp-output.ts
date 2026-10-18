import { fileSummary } from './ast-metrics-file-summary.ts';
import { jsonOf, type JsonObject } from './ast-metrics-json.ts';
import { rootPathOf } from './ast-metrics-root-path.ts';
import type { AstMetricsServer, AstMetricsWork } from './ast-metrics-server.ts';

// The path of a file call is as the command line gives it. workOf makes it a path from the root.
export type McpCall =
  | { readonly kind: 'file'; readonly path: string; readonly json: boolean }
  | { readonly kind: 'tool'; readonly name: string; readonly arguments: JsonObject }
  | { readonly kind: 'tools' };

export function workOf(call: McpCall, root: string): AstMetricsWork<string> {
  if (call.kind === 'tools') return toolList;
  if (call.kind === 'file') return fileWork(rootPathOf(root, call.path), call.json);
  return async (server) => formattedAnswer(await server.tool(call.name, call.arguments));
}

async function toolList(server: AstMetricsServer): Promise<string> {
  return (await server.tools()).map((tool) => `${tool.name}: ${tool.description ?? ''}\n`).join('');
}

function fileWork(path: string, json: boolean): AstMetricsWork<string> {
  return async (server) => {
    const text = await server.tool('get_file_metrics', { path });
    return json ? formattedAnswer(text) : fileSummary(path, text);
  };
}

function formattedAnswer(text: string): string {
  const value = jsonOf(text);
  if (value === undefined) return text.endsWith('\n') ? text : `${text}\n`;
  return `${JSON.stringify(value, null, 2)}\n`;
}
