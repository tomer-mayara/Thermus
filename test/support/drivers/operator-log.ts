import { stripVTControlCharacters } from 'node:util';

const listeningLine = /Listening on (http:\/\/\S+)/;
// The pattern ends at the full stop of the tenant line. Thus it gives only a complete ID.
const tenantLine = /tenant (local:[0-9a-f-]+)\./;
// In the text of a child process or a container, the console logger writes the time, the level, and the call site
// before each message. Thus a record does not start its line. The pattern finds the record from its first brace to
// the end of the line.
const completionLine = /\{"event":"mcp\.tool\.completed".*\}$/gm;
const stepLine = /\{"event":"pipeline\.step\.completed".*\}$/gm;
// A line of the console logger without its color codes: [time] LEVEL message, where the message starts with the call
// site.
const consoleLine = /^\[[^\]]*\] (DEBUG|INFO|WARNING|ERROR|FATAL) (.*)$/gm;

export interface ConsoleRecord {
  readonly level: string;
  readonly message: string;
}

// The records of the console logger in their order, without the time and the color codes.
export function consoleRecordsIn(output: string): ConsoleRecord[] {
  return Array.from(stripVTControlCharacters(output).matchAll(consoleLine), ([, level = '', message = '']) => ({ level, message }));
}

export function listeningUrlIn(output: string): URL | undefined {
  const address = listeningLine.exec(output)?.[1];
  return address === undefined ? undefined : new URL(address);
}

export function tenantIn(output: string): string | undefined {
  return tenantLine.exec(output)?.[1];
}

export function completionLinesIn(output: string, operationId?: string): string[] {
  const lines = output.match(completionLine) ?? [];
  return operationId === undefined ? lines : lines.filter((line) => JSON.parse(line).operationId === operationId);
}

export function completionRecordsIn(output: string, operationId?: string): Record<string, unknown>[] {
  return completionLinesIn(output, operationId).map((line) => JSON.parse(line) as Record<string, unknown>);
}

export function stepRecordsIn(output: string, operationId?: string): Record<string, unknown>[] {
  const records = (output.match(stepLine) ?? []).map((line) => JSON.parse(line) as Record<string, unknown>);
  return operationId === undefined ? records : records.filter((record) => record.operationId === operationId);
}
