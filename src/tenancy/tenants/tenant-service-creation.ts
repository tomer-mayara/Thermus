import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { ProvisioningClock } from './provisioning-clock.ts';
import { freeTenantEnvironment, type TenantPublicSettings } from './tenant-environment.ts';
import type { ClaimHold, ProvisioningRow } from './tenant-provisioning-store.ts';
import { attemptService, type AgainAttempt, type CreationPlatform, type ServiceOutcome } from './tenant-service-attempt.ts';

export type { ServiceOutcome } from './tenant-service-attempt.ts';

// The bound of 27 October 2026: a create is sent one time in each attempt, and a row has at most three attempts.
const CREATE_ATTEMPTS = 3;

export interface CreationParts {
  readonly platform: CreationPlatform;
  readonly clock: ProvisioningClock;
  readonly log: SystemLog;
  readonly tenant: TenantPublicSettings;
  readonly freePlan: string;
}

/**
 * The service of a claimed row. A deploying row has its service already. A creating row gets the one service with its
 * name, or a new free tenant, within three attempts; the operator gets one retry line before each later attempt. Each
 * create comes right after a renewal of the claim of the row (hold).
 */
export async function serviceOfRow(parts: CreationParts, row: ProvisioningRow, hold: ClaimHold, signal: AbortSignal): Promise<ServiceOutcome> {
  const { organizationId } = row;
  if (row.state === 'deploying') {
    return row.serviceId === null ? { status: 'failed', reason: 'The deploying row has no tenant service ID' } : { status: 'service', serviceId: row.serviceId };
  }
  const request = { name: row.serviceName, plan: parts.freePlan, environment: freeTenantEnvironment(organizationId, parts.tenant) };
  for (let attempt = 1; ; attempt += 1) {
    const result = await attemptService(parts.platform, request, hold, signal);
    if (result.status !== 'again') return result;
    if (attempt === CREATE_ATTEMPTS) return { status: 'failed', reason: `No tenant service after ${CREATE_ATTEMPTS} attempts. The last attempt: ${result.reason}` };
    parts.log.info(retryLine(organizationId, attempt + 1, result));
    await parts.clock.sleep(result.waitMs, signal);
  }
}

function retryLine(organizationId: string, attempt: number, again: AgainAttempt): string {
  return `Tenant provisioning retry: ${JSON.stringify({ organizationId, attempt, waitSeconds: again.waitMs / 1_000, reason: again.reason })}`;
}
