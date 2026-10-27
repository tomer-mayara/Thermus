type Environment = Readonly<Record<string, string | undefined>>;

// The secrets of the control plane. A tenant renders untrusted pages, so it must hold none of them (decision D-14).
// Each Stripe setting counts too, also a later one.
const CONTROL_PLANE_SECRETS = [
  'WORKOS_API_KEY',
  'WORKOS_CLIENT_SECRET',
  'WORKOS_COOKIE_PASSWORD',
  'GATEWAY_SIGNING_KEY',
  'DATABASE_URL',
  'LOGGING_DESTINATION_ENCRYPTION_KEY',
  'RENDER_API_KEY',
];
const STRIPE_SETTING = /^STRIPE_/;

/**
 * The refusal of a tenant environment that sets a secret of the control plane: it names each such setting in order,
 * never a value. An empty value holds no secret. Undefined when the environment sets none.
 */
export function controlPlaneSecretsRefusal(environment: Environment): string | undefined {
  const stripe = Object.keys(environment).filter((name) => STRIPE_SETTING.test(name));
  const present = [...CONTROL_PLANE_SECRETS, ...stripe].filter((name) => (environment[name] ?? '') !== '').sort();
  if (present.length === 0) return undefined;
  return `The tenant role refuses ${present.join(', ')}: a tenant holds no secret of the control plane. Remove ${present.length === 1 ? 'it' : 'them'} from the tenant environment.`;
}
