import { UsageError, usesStripe, usesWorkOS, type ProbeInputs } from './inputs.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// The secrets reach the probe only through the environment. No output holds one: the dry run and the report print
// <set>, and redact() removes a key or a signing secret from each message that the probe prints.
export interface ProbeSecrets {
  readonly stripeKey?: string;
  readonly priceId?: string;
  readonly workosKey?: string;
}

const PRODUCTION_CLIENT_ID = 'client_01M4VDKC291XX3CDEFP5ZKY5KP';
const PRICE_ID = /^price_[A-Za-z0-9]{4,250}$/;
const KEY_TEXT = /\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9*]+/g;
const SIGNING_SECRET_TEXT = /\bwhsec_[A-Za-z0-9*]+/g;
const BEARER_TEXT = /\bBearer\s+\S+/gi;

export function redact(text: string): string {
  return text.replace(KEY_TEXT, '<key>').replace(SIGNING_SECRET_TEXT, '<signing secret>').replace(BEARER_TEXT, 'Bearer <key>');
}

function value(environment: Environment, name: string): string | undefined {
  const raw = environment[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  if (/[\s\p{Cc}]/u.test(raw)) throw new UsageError(`${name} must not contain spaces or control characters.`);
  return raw;
}

function stripeKeyOf(environment: Environment, needed: boolean): string | undefined {
  const key = value(environment, 'STRIPE_RESTRICTED_KEY');
  if (key === undefined) {
    if (needed) throw new UsageError('STRIPE_RESTRICTED_KEY is not set. The Stripe steps need a restricted key of Stripe test mode; --dry-run and --workos-only need none.');
    return undefined;
  }
  if (/^(?:sk|rk)_live_/.test(key)) throw new UsageError('STRIPE_RESTRICTED_KEY is a live key. The probe runs in Stripe test mode only; give a restricted test key (rk_test_).');
  if (key.startsWith('sk_test_')) throw new UsageError('STRIPE_RESTRICTED_KEY is a secret key. Give a restricted test key (rk_test_) with the permissions of the record.');
  if (!key.startsWith('rk_test_')) throw new UsageError('STRIPE_RESTRICTED_KEY must be a restricted key of Stripe test mode: it starts with rk_test_.');
  return key;
}

function priceIdOf(environment: Environment): string {
  const id = value(environment, 'STRIPE_PRICE_ID');
  if (id === undefined) throw new UsageError('STRIPE_PRICE_ID is not set. The Stripe steps need the ID of the metered monthly price on the meter "User Seat Count".');
  if (!PRICE_ID.test(id)) throw new UsageError('STRIPE_PRICE_ID must be a Stripe price ID: price_ and letters or digits.');
  return id;
}

function workosKeyOf(environment: Environment): string {
  const key = value(environment, 'WORKOS_API_KEY');
  if (key === undefined) throw new UsageError('WORKOS_API_KEY is not set. Run the probe through the WorkOS Staging launcher, ~/.config/thermus/with-workos-staging.cjs.');
  if (key.startsWith('sk_live_')) throw new UsageError('WORKOS_API_KEY is a production key. The probe runs in the WorkOS Staging environment only.');
  if (!key.startsWith('sk_test_')) throw new UsageError('WORKOS_API_KEY must be a key of the WorkOS Staging environment: it starts with sk_test_.');
  return key;
}

function refuseProductionClient(environment: Environment): void {
  if (environment.WORKOS_CLIENT_ID === PRODUCTION_CLIENT_ID) {
    throw new UsageError('WORKOS_CLIENT_ID names the client of the WorkOS Production environment. The probe never touches it; run it through the Staging launcher.');
  }
}

// Each guard runs before any call. The sweep of earlier runs uses the Stripe key when it is set.
export function readSecrets(environment: Environment, inputs: ProbeInputs): ProbeSecrets {
  refuseProductionClient(environment);
  const stripe = usesStripe(inputs);
  const stripeKey = stripe || inputs.sweep ? stripeKeyOf(environment, stripe) : undefined;
  const priceId = stripe ? priceIdOf(environment) : undefined;
  const workosKey = usesWorkOS(inputs) ? workosKeyOf(environment) : undefined;
  return Object.freeze({ stripeKey, priceId, workosKey });
}

// For the dry run: the state of each variable, never its value. The price ID is not a secret.
export function variableStates(environment: Environment): readonly string[] {
  const shown = (name: string): string => ((environment[name] ?? '').trim() === '' ? '<not set>' : '<set>');
  const price = environment.STRIPE_PRICE_ID;
  return [
    `STRIPE_RESTRICTED_KEY: ${shown('STRIPE_RESTRICTED_KEY')}`,
    `STRIPE_PRICE_ID: ${price !== undefined && PRICE_ID.test(price) ? price : shown('STRIPE_PRICE_ID')}`,
    `WORKOS_API_KEY: ${shown('WORKOS_API_KEY')}`,
  ];
}
