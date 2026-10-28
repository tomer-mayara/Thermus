import type { DeployStart, ServiceChange } from '../../tenants/tenant-platform.ts';
import type { RenderAnswer, RenderExchange } from './render-api.ts';
import { limitWaitOf } from './render-creation.ts';
import { deployOfAnswer } from './render-deploys.ts';
import { answerReason } from './render-exchanges.ts';

// An image reference by digest, with the rule of TENANT_IMAGE: a registry host, a path, and sha256 with 64 hexadecimal
// digits. A tag can move, so a fleet deploy names the exact image that the gate of the release tested.
const IMAGE_BY_DIGEST = /^[a-z0-9][a-z0-9.-]*(?::\d{1,5})?(?:\/[a-z0-9][a-z0-9._-]*)+@sha256:[0-9a-f]{64}$/;

type NotTaken = Exclude<ServiceChange, { readonly status: 'accepted' }>;

export function isImageByDigest(image: string): boolean {
  return IMAGE_BY_DIGEST.test(image);
}

/**
 * The outcome of one deploy call. Render answers 201 with the new deploy, or 202 without a body when it queues the
 * deploy (SO-01c). A 5xx or a lost answer can come after Render started the deploy, so it is unknown, not refused.
 */
export function deployStartOf(exchange: RenderExchange): DeployStart {
  const { answer } = exchange;
  if (answer === undefined) return { status: 'unknown', reason: exchange.failure };
  if (answer.status === 202) return { status: 'started' };
  if (answer.status < 200 || answer.status >= 300) return notTakenOf(answer);
  const deploy = deployOfAnswer(answer.json);
  return deploy === undefined ? { status: 'unknown', reason: `Render answered ${answer.status} without a valid deploy` } : { status: 'started', deploy };
}

/** The outcome of one suspend or resume call: Render answers 202 without a body (SO-01c). */
export function serviceChangeOf(exchange: RenderExchange): ServiceChange {
  const { answer } = exchange;
  if (answer === undefined) return { status: 'unknown', reason: exchange.failure };
  return answer.status >= 200 && answer.status < 300 ? { status: 'accepted' } : notTakenOf(answer);
}

// 404 and 410 (no longer available) mean that the service is gone; each other 4xx is a refusal with its reason.
function notTakenOf(answer: RenderAnswer): NotTaken {
  if (answer.status === 429) return { status: 'rate-limited', retryAfterMs: limitWaitOf(answer.limits) };
  if (answer.status === 404 || answer.status === 410) return { status: 'gone' };
  return { status: answer.status >= 500 ? 'unknown' : 'refused', reason: answerReason(answer) };
}
