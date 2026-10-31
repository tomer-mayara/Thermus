import type { CallToolRequestParams, Client, RequestOptions, Tool } from '@modelcontextprotocol/client';
import { CommandError } from '../shared/repository.ts';

export interface AstMetricsServer {
  tool(name: string, args: Readonly<Record<string, unknown>>): Promise<string>;
  tools(): Promise<Tool[]>;
}

export type AstMetricsWork<T> = (server: AstMetricsServer) => Promise<T>;

// ast-metrics answers each tool call with one text item. An error answer becomes the diagnostic of the command.
async function answerText(client: Client, call: CallToolRequestParams, callOptions: RequestOptions): Promise<string> {
  const result = await client.callTool(call, callOptions);
  const texts = result.content.filter((item) => item.type === 'text').map((item) => item.text);
  if (result.isError) throw new CommandError(`${call.name} failed: ${texts.join(' ')}`);
  if (result.content.length !== 1 || texts.length !== 1) throw new CommandError(`${call.name} gave an unexpected answer: expected one text item.`);
  return texts[0];
}

export function serverOf(client: Client, callOptions: RequestOptions): AstMetricsServer {
  return {
    tool: (name, args) => answerText(client, { name, arguments: args }, callOptions),
    tools: async () => (await client.listTools(undefined, callOptions)).tools,
  };
}
