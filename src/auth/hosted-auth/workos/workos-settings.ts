type Environment = Readonly<Record<string, string | undefined>>;

// The settings of the WorkOS provider. The provider reads them itself, so no common setting turns WorkOS on.
export interface WorkOSSettings {
  readonly apiKey: string;
  readonly clientId: string;
  // Exactly as written: Connect access tokens must carry this issuer.
  readonly authkitIssuer: string;
  readonly redirectUri: string;
  readonly cookiePassword: string;
}

export class WorkOSSettingsError extends Error {
  public constructor(problems: readonly string[]) {
    super([
      'The hosted edition cannot start: the WorkOS settings are not valid.',
      ...problems.map((problem) => `- ${problem}`),
      'The hosted edition gives no access without its WorkOS provider.',
    ].join('\n'));
    this.name = 'WorkOSSettingsError';
  }
}

// A refusal gives the rule that a value breaks. It must not contain the value.
type Refusal = (value: string) => string | undefined;

const SPACE_OR_CONTROL_CHARACTER = /[\s\p{Cc}]/u;
const MIN_COOKIE_PASSWORD_LENGTH = 32;

// The browser access tokens of the environment client have this issuer.
export function browserSessionIssuer(clientId: string): string {
  return `https://api.workos.com/user_management/${clientId}`;
}

// The one identity authority of the WorkOS environment. Browser sessions and Connect tokens both map their users
// into it, so the same organization gives the same tenant. The client ID of an MCP client never changes it.
export function workosAuthority(clientId: string): string {
  return `workos:${clientId}`;
}

export function loadWorkOSSettings(environment: Environment, publicBaseUrl: string): WorkOSSettings {
  const problems: string[] = [];
  const read = (name: string, refusal: Refusal): string => {
    const value = environment[name] ?? '';
    const reason = value === '' ? 'it is missing or empty.' : refusal(value);
    if (reason !== undefined) problems.push(`${name} is not valid: ${reason}`);
    return value;
  };
  const settings: WorkOSSettings = {
    apiKey: read('WORKOS_API_KEY', prefixRefusal('sk_', 'a WorkOS API key')),
    clientId: read('WORKOS_CLIENT_ID', prefixRefusal('client_', 'a WorkOS client ID')),
    authkitIssuer: read('WORKOS_AUTHKIT_ISSUER', issuerRefusal),
    redirectUri: read('WORKOS_REDIRECT_URI', redirectRefusal(publicBaseUrl)),
    cookiePassword: read('WORKOS_COOKIE_PASSWORD', cookiePasswordRefusal),
  };
  if (problems.length > 0) throw new WorkOSSettingsError(problems);
  return Object.freeze(settings);
}

function prefixRefusal(prefix: string, kind: string): Refusal {
  return (value) => {
    if (SPACE_OR_CONTROL_CHARACTER.test(value)) return 'it must not contain spaces or control characters.';
    return value.startsWith(prefix) ? undefined : `it must be ${kind} that starts with ${prefix}.`;
  };
}

// The issuer of AuthKit is an origin. A path or a final slash would make the exact issuer check refuse each token.
function issuerRefusal(value: string): string | undefined {
  const url = URL.parse(value);
  const origin = url?.protocol === 'https:' && url.username === '' && url.password === '' ? url.origin : undefined;
  if (origin !== undefined && origin === value) return undefined;
  return 'it must be the https origin of the AuthKit domain, such as https://example.authkit.app, without a path, a final slash, a username, a password, a query, or a fragment.';
}

function redirectRefusal(publicBaseUrl: string): Refusal {
  const base = new URL(publicBaseUrl);
  return (value) => {
    const url = URL.parse(value);
    if (url !== null && url.href === value && !SPACE_OR_CONTROL_CHARACTER.test(value) && isPageOf(url, base)) return undefined;
    return 'it must be an https URL on the origin of PUBLIC_BASE_URL, inside its path, without a username, a password, a query, or a fragment, and written as the URL parser writes it.';
  };
}

function isPageOf(url: URL, base: URL): boolean {
  const insideBase = url.protocol === 'https:' && url.origin === base.origin && url.pathname.startsWith(base.pathname);
  return insideBase && url.username === '' && url.search === '' && url.hash === '';
}

function cookiePasswordRefusal(value: string): string | undefined {
  if (value.length >= MIN_COOKIE_PASSWORD_LENGTH) return undefined;
  return `it must have at least ${MIN_COOKIE_PASSWORD_LENGTH} characters.`;
}
