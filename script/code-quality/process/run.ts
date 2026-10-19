import { failureText, processReportOf } from './report.ts';
import type { StageReport } from '../shared/report.ts';
import type { ArchitectureAnalysis, CoverageChoice, ProcessOperations, StageOutcome } from './types.ts';

const names = ['Delta', 'Review', 'CRAP', 'Architecture'];

export async function runProcess(operations: ProcessOperations): Promise<StageReport> {
  const outcomes: StageOutcome[] = [];
  let architecture: ArchitectureAnalysis | undefined;
  try {
    outcomes.push(completed('Delta', operations.delta()));
    outcomes.push(completed('Review', operations.review()));
    const choice = operations.coverage();
    outcomes.push(await crapOutcome(operations, choice));
    architecture = await operations.architecture(choice);
    outcomes.push({ name: 'Architecture', status: 'passed', text: architecture.text });
  } catch (error) { appendFailure(outcomes, error); }
  let text = processReportOf(outcomes);
  if (architecture !== undefined && outcomes.every(({ status }) => status === 'passed' || status === 'goal miss')) {
    try {
      outcomes[3] = { name: 'Architecture', status: 'passed', text: architecture.publish() };
    } catch (error) {
      outcomes[3] = { name: 'Architecture', status: 'failed', text: `${architecture.text.trim()}\n\nHistory recording failed: ${failureText(error)}` };
    }
    text = processReportOf(outcomes);
  }
  return { text, passed: outcomes.every(({ status }) => status === 'passed') };
}

function completed(name: string, report: StageReport): StageOutcome {
  return { name, status: report.passed ? 'passed' : 'goal miss', text: report.text };
}

async function crapOutcome(operations: ProcessOperations, choice: CoverageChoice): Promise<StageOutcome> {
  if (choice.required && choice.file === undefined) {
    return { name: 'CRAP', status: 'unavailable', text: `${choice.notice}\n\nRequired CRAP goals are unresolved. No assessment was made.` };
  }
  const result = completed('CRAP', await operations.crap());
  return { ...result, text: `${choice.notice}\n\n${result.text}` };
}

function appendFailure(outcomes: StageOutcome[], error: unknown): void {
  outcomes.push({ name: names[outcomes.length], status: 'failed', text: failureText(error) });
  while (outcomes.length < names.length) outcomes.push({ name: names[outcomes.length], status: 'unavailable', text: 'A prerequisite failed. This stage did not run.' });
}
