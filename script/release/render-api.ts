// A read repeats after a 429, a 5xx answer, or a network failure. A write goes one time only, because a repeated
// deploy can double its effect. No output holds the key or a request header.
import { setTimeout as sleep } from 'node:timers/promises';

const API_BASE = 'https://api.render.com/v1';
const REQUEST_TIMEOUT_MS = 30_000;
const READ_ATTEMPTS = 3;
const RETRY_MS = 5_000;
const MESSAGE_LIMIT = 300;

export interface Answer {
  readonly status: number;
  readonly json: unknown;
}

type Outcome = Answer | { readonly status?: undefined; readonly failure: string };

export class RenderApi {
  readonly #key: string;

  public constructor(key: string) {
    this.#key = key;
  }

  public async read(path: string): Promise<unknown> {
    let failure = 'got no answer';
    for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
      const outcome = await this.#send('GET', path);
      if (outcome.status !== undefined && outcome.status < 400) return outcome.json;
      failure = outcomeText(outcome);
      if (outcome.status !== undefined && !retryable(outcome.status)) break;
      if (attempt < READ_ATTEMPTS) await sleep(RETRY_MS);
    }
    throw new Error(`GET ${path} ${failure}`);
  }

  public async post(path: string, body: unknown): Promise<Answer> {
    const outcome = await this.#send('POST', path, body);
    if (outcome.status === undefined || outcome.status >= 400) throw new Error(`POST ${path} ${outcomeText(outcome)}`);
    return outcome;
  }

  async #send(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Outcome> {
    const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${this.#key}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return { status: response.status, json: parseJson(await response.text()) };
    } catch (error) {
      return { failure: `got no answer: ${messageOf(error)}` };
    }
  }
}

export function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : '';
  return `${message}${cause}`;
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function outcomeText(outcome: Outcome): string {
  if (outcome.status === undefined) return outcome.failure;
  const json = outcome.json;
  const message = typeof json === 'object' && json !== null && 'message' in json && typeof json.message === 'string' ? `: ${json.message.slice(0, MESSAGE_LIMIT)}` : '';
  return `answered ${outcome.status}${message}`;
}

function parseJson(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
