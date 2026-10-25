import { readFile, writeFile } from 'node:fs/promises';
import { OtlpAuditSender, type AuditDestination, type AuditSendOutcome } from '../../../src/logs/audit/otlp-audit-sender.ts';
import type { AuditEvent } from '../../../src/logs/audit/audit-log.ts';

interface Submission extends AuditDestination {
  readonly event: AuditEvent;
  readonly resolveTo?: string;
  readonly cancelAfterMs?: number;
}

const submissions: Submission[] = JSON.parse(await readFile('/fixture/submissions.json', 'utf8'));
const sender = new OtlpAuditSender();
const outcomes: AuditSendOutcome[] = [];
for (const submission of submissions) {
  if (submission.resolveTo !== undefined) {
    const previous = await readFile('/etc/hosts', 'utf8');
    const withoutCollector = previous.split('\n').filter((line) => !line.includes('collector.audit.test')).join('\n');
    await writeFile('/etc/hosts', `${withoutCollector}\n${submission.resolveTo} collector.audit.test\n`);
  }
  const controller = new AbortController();
  const timer = submission.cancelAfterMs === undefined ? undefined : setTimeout(() => controller.abort(), submission.cancelAfterMs);
  try {
    outcomes.push(await sender.send({ endpoint: submission.endpoint, auth: submission.auth, axiomDataset: submission.axiomDataset }, submission.event, controller.signal));
  } finally {
    clearTimeout(timer);
  }
}
process.stdout.write(`${JSON.stringify(outcomes)}\n`);
