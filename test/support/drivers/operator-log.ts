// The functions in this file read the operator log of the server. Three sites keep the log, each in a different form.
// ServerProcess keeps the text of the child process. ServerContainer keeps the text of docker start --attach.
// InProcessServer keeps the messages of its logger as lines. Each site gives the log to these functions as one text.
const listeningLine = /Listening on (http:\/\/\S+)/;
// The pattern ends at the full stop of the tenant line. Thus it gives only a complete ID.
const tenantLine = /tenant (local:[0-9a-f-]+)\./;
// In the text of a child process or a container, the console logger writes the time, the level, and the call site
// before each message. Thus a record does not start its line. The pattern finds the record from its first brace to
// the end of the line.
const completionLine = /\{"event":"mcp\.tool\.completed".*\}$/gm;
const stepLine = /\{"event":"pipeline\.step\.completed".*\}$/gm;

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
