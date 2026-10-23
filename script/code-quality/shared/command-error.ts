// Expected failures print a command diagnostic and exit 1.
export class CommandError extends Error {}

export const notInstalled = 'The local ast-metrics runtime could not start. Run pnpm exec node script/code-quality/ast-metrics-install.ts. See docs/implementation/ast-metrics-review.md.';

export function reportCommandError(command: string, error: unknown): void {
  if (!(error instanceof CommandError)) throw error;
  process.stderr.write(`${command}: ${error.message}\n`);
  process.exitCode = 1;
}

export function reportFailure(command: string, error: unknown): void {
  const message = error instanceof CommandError ? error.message : `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
  // A diagnostic stays on one line, also when a tool writes several lines.
  process.stderr.write(`${command}: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
}
