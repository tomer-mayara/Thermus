import { realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { CommandError } from '../shared/repository.ts';
import { fileSummary } from './file-summary.ts';
import { jsonOf, type JsonObject } from '../shared/json.ts';
import type { AstMetricsServer, AstMetricsWork } from './server.ts';

export type McpCall =
  | { readonly kind: 'file'; readonly path: string; readonly json: boolean }
  | { readonly kind: 'tool'; readonly name: string; readonly arguments: JsonObject }
  | { readonly kind: 'tools' };

export function workOf(call: McpCall, root: string): AstMetricsWork<string> {
  if (call.kind === 'tools') return toolList;
  if (call.kind === 'file') return fileWork(rootPathOf(root, call.path), call.json);
  return async (server) => formattedAnswer(await server.tool(call.name, call.arguments));
}

// The server names a file by its path from the root, with forward slashes. git gives the physical path of the root,
// so the folder of the path is resolved too: on macOS the temporary folders are symbolic links. A folder that does
// not exist stays as it is; the server then tells that it does not know the file.
function rootPathOf(root: string, path: string): string {
  const absolute = resolve(path);
  let folder = dirname(absolute);
  try { folder = realpathSync(folder); } catch { /* The folder does not exist. */ }
  const fromRoot = relative(root, join(folder, basename(absolute)));
  if (fromRoot === '' || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) throw new CommandError(`The path must name a file in the repository root ${root}.`);
  return fromRoot.split(sep).join('/');
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
