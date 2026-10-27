// The HTTP client of the Render API v1, from the calls of the SO-01c probe. The API key stays in a private field: no
// result, reason, or log line holds the key or a request header.

const API_BASE = 'https://api.render.com/v1';
const REQUEST_TIMEOUT_MS = 30_000;

export interface RenderCall {
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
}

/** The rate-limit headers of an answer, in seconds. Ratelimit-Reset gives the seconds until the window resets. */
export interface RenderLimits {
  readonly remaining?: number;
  readonly resetSeconds?: number;
  readonly retryAfterSeconds?: number;
}

export interface RenderAnswer {
  readonly status: number;
  readonly json: unknown;
  readonly limits: RenderLimits;
}

/** An answer, or the failure of a call that got no answer: a network failure or the timeout of the call. */
export type RenderExchange =
  | { readonly answer: RenderAnswer }
  | { readonly answer?: undefined; readonly failure: string };

/** The time of the adapter: a monotonic clock in milliseconds, and a wait that the caller's signal ends. */
export interface RenderClock {
  now(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export class RenderApi {
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;

  constructor(apiKey: string, fetchFunction: typeof fetch) {
    this.#apiKey = apiKey;
    this.#fetch = fetchFunction;
  }

  /** Sends one call. A stop of the caller rejects; every other failure gives an exchange without an answer. */
  async send(call: RenderCall, signal: AbortSignal): Promise<RenderExchange> {
    signal.throwIfAborted();
    const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${this.#apiKey}` };
    if (call.body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const response = await this.#fetch(`${API_BASE}${call.path}`, {
        method: call.method,
        headers,
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      });
      return { answer: { status: response.status, json: jsonOf(await response.text()), limits: limitsOf(response.headers) } };
    } catch (error) {
      signal.throwIfAborted();
      return { failure: `no answer: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

function jsonOf(text: string): unknown {
  try {
    return text === '' ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

function limitsOf(headers: Headers): RenderLimits {
  const seconds = (name: string): number | undefined => {
    const value = headers.get(name)?.trim();
    return value !== undefined && /^\d{1,7}$/.test(value) ? Number(value) : undefined;
  };
  return { remaining: seconds('ratelimit-remaining'), resetSeconds: seconds('ratelimit-reset'), retryAfterSeconds: seconds('retry-after') };
}
