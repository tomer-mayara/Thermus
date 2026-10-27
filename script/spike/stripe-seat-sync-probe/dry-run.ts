import type { Placeholders, PlannedCall } from './calls.ts';
import type { ProbeStep } from './context.ts';
import type { ProbeInputs } from './inputs.ts';
import { variableStates } from './secrets.ts';
import { cleanupStep, preflightStep, sweepStep, workosOnlyStep, workSteps } from './steps.ts';

type Environment = Readonly<Record<string, string | undefined>>;

const DRY_RUN_TOKEN = 'YYYYMMDD-HHMMSS-xxxx';

const FLAT_LIMIT = 110;

// A read shows its parameters in the query of its path, so only a write prints them.
function paramsText(call: PlannedCall): readonly string[] {
  if (call.params === undefined || call.line.startsWith('GET ')) return [];
  const flat = JSON.stringify(call.params);
  return flat.length <= FLAT_LIMIT ? [`  ${flat}`] : JSON.stringify(call.params, null, 2).split('\n').map((line) => `  ${line}`);
}

function callText(call: PlannedCall): readonly string[] {
  return [call.sdk === undefined ? call.line : `${call.line}   (${call.sdk})`, ...paramsText(call), `  -> ${call.note}`];
}

function stepsOf(inputs: ProbeInputs): readonly ProbeStep[] {
  if (inputs.sweep) return [sweepStep];
  const work = inputs.workosOnly ? [workosOnlyStep] : workSteps.filter((step) => inputs.steps.includes(step.id));
  return [preflightStep, ...work, cleanupStep];
}

function priceOf(environment: Environment): string {
  const price = environment.STRIPE_PRICE_ID;
  return price !== undefined && /^price_[A-Za-z0-9]{4,250}$/.test(price) ? price : '{STRIPE_PRICE_ID}';
}

export function renderDryRun(inputs: ProbeInputs, environment: Environment): string {
  const values: Placeholders = { run: DRY_RUN_TOKEN, priceId: priceOf(environment), meterId: '{meterId}' };
  const header = [
    '# SO-01f dry run: planned calls', '',
    'No network call and no write. Real mode sends these SDK calls in this order: Stripe calls to https://api.stripe.com',
    'with "Authorization: Bearer <set>" (STRIPE_RESTRICTED_KEY), WorkOS calls to https://api.workos.com with',
    '"Authorization: Bearer <set>" (WORKOS_API_KEY). No output holds a key or the signing secret. A name in braces comes',
    `from an earlier answer. In real mode, ${DRY_RUN_TOKEN} is the UTC start time and four random hexadecimal digits.`, '',
    ...variableStates(environment).map((line) => `- ${line}`),
    `- Steps: ${inputs.sweep ? 'cleanup (the sweep of earlier runs)' : inputs.steps.join(', ')}${inputs.workosOnly ? ' (WorkOS only)' : ''}`,
    `- End: ${inputs.keep ? 'the objects of the run are kept when every step passed (--keep)' : 'the cleanup deletes the objects of the run'}`,
  ];
  const body = stepsOf(inputs).flatMap((step) => ['', `## ${step.name}`, '', step.spec, '', ...step.plan(inputs, values).flatMap(callText)]);
  return `${[...header, ...body].join('\n')}\n`;
}
