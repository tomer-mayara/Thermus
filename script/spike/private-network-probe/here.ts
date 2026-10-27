// Requests and DNS lookups from this machine, outside the Render network. They send no Render key.
import { lookup } from 'node:dns/promises';

export type Outcome =
  | { readonly status: number; readonly body: string; readonly ms: number }
  | { readonly status?: undefined; readonly error: string; readonly message: string; readonly ms: number };

export type Lookup = { readonly address: string } | { readonly address?: undefined; readonly code: string };

const BODY_LIMIT = 100;
const MESSAGE_LIMIT = 200;

function failure(error: unknown): { readonly error: string; readonly message: string } {
  const top = error instanceof Error ? error : new Error(String(error));
  const cause = top.cause instanceof Error ? top.cause : undefined;
  const code = cause !== undefined && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
  return { error: code ?? top.name, message: (cause ?? top).message.slice(0, MESSAGE_LIMIT) };
}

export async function requestHere(url: string, timeoutMs: number, signal: AbortSignal): Promise<Outcome> {
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
    const body = (await response.text()).slice(0, BODY_LIMIT);
    return { status: response.status, body, ms: performance.now() - started };
  } catch (error) {
    if (signal.aborted) throw error;
    return { ...failure(error), ms: performance.now() - started };
  }
}

export async function lookupHere(host: string): Promise<Lookup> {
  try {
    return { address: (await lookup(host)).address };
  } catch (error) {
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'no code';
    return { code };
  }
}

export function outcomeText(outcome: Outcome): string {
  const ms = `${Math.round(outcome.ms)} ms`;
  if (outcome.status === undefined) return `no answer: ${outcome.error}, "${outcome.message}", after ${ms}`;
  return `${outcome.status}, body ${JSON.stringify(outcome.body)}, after ${ms}`;
}

export function answeredOk(outcome: Outcome): boolean {
  return outcome.status === 200 && outcome.body.trim() === 'ok';
}
