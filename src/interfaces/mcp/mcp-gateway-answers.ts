import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import type { ForwardedBody, ForwardedMessage } from './mcp-gateway-request.ts';

// The words of the answers of 27 October 2026 and of section 4.2 of the self on-boarding plan. The portal uses the
// words of a failed setup and of a full cap too.
export const GATEWAY_WORDS = Object.freeze({
  starting: 'Your workspace is not ready yet. Try again in 15 seconds.',
  resuming: 'Your workspace is restarting after a pause. Try again in a minute.',
  failed: 'Workspace setup failed. We have been notified and will fix it.',
  deleted: 'Your workspace is not available. Contact Thermus support.',
  capacity: 'All free workspaces are in use. Try again later.',
  unavailable: 'The service is temporarily unavailable. Try again in 15 seconds.',
  restarted: 'Server restarted. Try again in a minute.',
  busy: 'Server busy. Try again later.',
});

const INTERNAL_ERROR = -32603;

export function unavailableAnswer(words: string, retryAfterSeconds?: number): Response {
  const headers = retryAfterSeconds === undefined ? undefined : { 'Retry-After': String(retryAfterSeconds) };
  return Response.json(new OAuthError(OAuthErrorCode.TemporarilyUnavailable, words).toResponseObject(), { status: 503, headers });
}

/**
 * The answer of the gateway itself to each JSON-RPC request of the body: a tool error for tools/call, and a JSON-RPC
 * error for each other method, both with the words. A batch gets an array. Undefined when the body holds no request,
 * because only a request with an id can get an answer.
 */
export function messageAnswers(body: ForwardedBody, words: string): Response | undefined {
  const answers = body.messages.filter(isRequest).map((message) => answerTo(message, words));
  if (answers.length === 0) return undefined;
  return Response.json(body.batch ? answers : answers[0]);
}

// The result type is required in protocol 2026-07-28, and a 2025-era client removes it.
function answerTo(message: ForwardedMessage & { readonly id: string | number }, words: string): object {
  if (message.method === 'tools/call') {
    return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: words }], isError: true, resultType: 'complete' } };
  }
  return { jsonrpc: '2.0', id: message.id, error: { code: INTERNAL_ERROR, message: words } };
}

function isRequest(message: ForwardedMessage): message is ForwardedMessage & { readonly id: string | number } {
  return message.id !== undefined && message.method !== undefined;
}
