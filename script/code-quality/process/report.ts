import type { StageOutcome } from './types.ts';

export function processReportOf(outcomes: readonly StageOutcome[]): string {
  return `# Code quality process\n\n${outcomes.map(sectionOf).join('\n')}`;
}

function sectionOf({ name, status, text }: StageOutcome): string {
  const content = text.endsWith('\n') ? text : `${text}\n`;
  const body = name === 'Delta' ? `\`\`\`text\n${content}\`\`\`\n` : content;
  return `## ${name}\n\nStatus: ${status}.\n\n${body}`;
}

export function failureText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, ' ').trim();
}
