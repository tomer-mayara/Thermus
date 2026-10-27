import { action, type Placeholders, type PlannedCall } from './calls.ts';
import { addRow, remember, seconds, type ProbeContext } from './context.ts';
import { ListenSession, listenArgs, runCli, shellLine, tail, triggerArgs } from './stripe-cli.ts';
import { CHECK_HEADER, WEBHOOK_PATH, WebhookListener, type Delivery } from './webhook-listener.ts';

const STEP = 'Webhook';
const EVENTS = ['customer.created', 'customer.subscription.created'];
const TRIGGER_LIMIT_MS = 120_000;
const DELIVERY_LIMIT_MS = 60_000;

function secretOf(context: ProbeContext): string {
  const secret = context.state.signingSecret;
  if (secret === undefined) throw new Error('No signing secret: the preflight did not read it from the Stripe CLI.');
  return secret;
}

function priceIdOf(context: ProbeContext): string {
  const id = context.secrets.priceId;
  if (id === undefined) throw new Error('No STRIPE_PRICE_ID.');
  return id;
}

// A payload with one changed value: the subscription status. The signature of the original no longer matches.
function changedPayload(raw: string): string {
  const event = JSON.parse(raw) as { data: { object: Record<string, unknown> } };
  event.data.object.status = event.data.object.status === 'canceled' ? 'active' : 'canceled';
  return JSON.stringify(event, null, 2);
}

async function post(listener: WebhookListener, check: { readonly label: string; readonly body: string; readonly signature?: string }): Promise<number> {
  const headers: Record<string, string> = { 'content-type': 'application/json', [CHECK_HEADER]: check.label };
  if (check.signature !== undefined) headers['stripe-signature'] = check.signature;
  const response = await fetch(listener.url, { method: 'POST', headers, body: check.body, signal: AbortSignal.timeout(10_000) });
  await response.body?.cancel();
  return response.status;
}

// The CLI prints no ID, so the events of this run name the customer and the subscription to delete.
function rememberTriggered(context: ProbeContext, deliveries: readonly Delivery[]): void {
  const ids = new Map<string, 'customer' | 'subscription'>();
  for (const delivery of deliveries.filter((item) => item.status === 200 && item.runMatch)) {
    if (delivery.type === 'customer.created' && delivery.objectId !== undefined) ids.set(delivery.objectId, 'customer');
    if (delivery.type !== 'customer.subscription.created') continue;
    if (delivery.objectId !== undefined) ids.set(delivery.objectId, 'subscription');
    if (delivery.customerId !== undefined) ids.set(delivery.customerId, 'customer');
  }
  for (const [id, kind] of ids) remember(context, { system: 'Stripe', kind, id, step: STEP });
}

async function trigger(context: ProbeContext): Promise<number> {
  const started = performance.now();
  const result = await runCli(triggerArgs(context.run, priceIdOf(context)), { timeoutMs: TRIGGER_LIMIT_MS, signal: context.signal });
  addRow(context, STEP, { check: 'stripe trigger customer.subscription.created', expected: 'exit code 0; "Trigger succeeded"', measured: `exit code ${result.code ?? 'none'} after ${seconds(result.ms)}: ${tail(result.output)}` });
  if (result.code !== 0 || !result.output.includes('Trigger succeeded')) throw new Error(`stripe trigger failed: ${tail(result.output)}`);
  return started;
}

async function checkSignatures(context: ProbeContext, listener: WebhookListener, accepted: Delivery): Promise<string> {
  const changed = await post(listener, { label: 'changed payload', body: changedPayload(accepted.raw), signature: accepted.signature });
  addRow(context, STEP, { check: 'The same event with a changed status and the original signature', expected: '400', measured: String(changed) });
  const unsigned = await post(listener, { label: 'no signature', body: accepted.raw });
  addRow(context, STEP, { check: 'The same event without the Stripe-Signature header', expected: '400', measured: String(unsigned) });
  const repeated = await post(listener, { label: 'repeat', body: accepted.raw, signature: accepted.signature });
  addRow(context, STEP, { check: 'The same event again, unchanged, within the 300 s tolerance', expected: '200: the check alone accepts a repeat, so SO-13 drops a repeated event ID', measured: String(repeated) });
  if (changed !== 400 || unsigned !== 400) throw new Error(`The listener answered ${changed} to the changed payload and ${unsigned} to the payload without a signature; both must be 400.`);
  if (repeated !== 200) throw new Error(`The listener answered ${repeated} to the unchanged event: the signature check refused a valid signature.`);
  return `refused the changed payload (${changed}) and the payload without a signature (${unsigned}), and accepted the unchanged repeat (${repeated})`;
}

async function webhook(context: ProbeContext): Promise<string> {
  const listener = await WebhookListener.start(secretOf(context), context.run);
  let session: ListenSession | undefined;
  try {
    const started = performance.now();
    session = await ListenSession.start(listener.url, EVENTS, context.signal);
    addRow(context, STEP, { check: `stripe listen --forward-to ${listener.url}`, expected: '"Ready!" within 60 s', measured: `ready after ${seconds(performance.now() - started)}` });
    const triggered = await trigger(context);
    const accepted = await listener.waitFor((item) => item.status === 200 && item.type === 'customer.subscription.created' && item.runMatch, DELIVERY_LIMIT_MS, context.signal);
    rememberTriggered(context, listener.deliveries);
    addRow(context, STEP, { check: 'Signed customer.subscription.created of this run, from the CLI', expected: 'accepted: 200', measured: `${accepted.eventId ?? 'no ID'}: 200, ${seconds(accepted.at - triggered)} after the trigger started` });
    const checks = await checkSignatures(context, listener, accepted);
    return `the listener accepted the signed event ${accepted.eventId ?? ''} of the CLI, ${checks}.`;
  } finally {
    await session?.stop();
    await listener.close();
  }
}

export function webhookPlan(_inputs: unknown, values: Placeholders): readonly PlannedCall[] {
  const url = `http://127.0.0.1:{port}${WEBHOOK_PATH}`;
  return [
    action(`(local) listener on ${url}`, 'Verifies each request with stripe.webhooks.constructEvent(raw body, Stripe-Signature, signing secret): 200 or 400.'),
    action(`$ ${shellLine(listenArgs(url, EVENTS))}`, 'Started as a child process; it forwards the signed events of test mode until the step ends.'),
    action(`$ ${shellLine(triggerArgs(values.run, values.priceId))}`, 'Makes a customer and a subscription on the price; both carry the run token, and the cleanup deletes the customer.'),
    action('(local) wait', `At most ${DELIVERY_LIMIT_MS / 1_000} s for a customer.subscription.created of this run, accepted with 200.`),
    action(`(local) POST ${url} three times`, 'The event with a changed status and the original signature (400), without a signature (400), and unchanged again (200).'),
  ];
}

export { webhook };
