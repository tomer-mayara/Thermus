import type { StageOutcome } from './types.ts';

export function processReportOf(outcomes: readonly StageOutcome[]): string {
  return `# Code quality process\n\n${outcomes.map(({ name, status, text }) => `## ${name}\n\nStatus: ${status}.\n\n${text.trim()}\n`).join('\n')}`;
}

export function failureText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, ' ').trim();
}
