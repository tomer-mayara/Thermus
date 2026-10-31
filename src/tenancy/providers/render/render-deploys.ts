import type { DeployProgress, PlatformDeploy } from '../../tenants/tenant-platform.ts';
import { recordOf } from './render-services.ts';

// The forms that the SO-01c probe saw. A digest of another form is not stored, so the row keeps the digest that it has.
const DEPLOY_ID = /^dep-[a-z0-9]+$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
// A deactivated deploy is the newest one only when nothing replaced it, so it ends the deploy as a failure.
const FAILED_STATUSES = new Set(['build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);

type DatedDeploy = PlatformDeploy & { readonly createdAt: number };

/**
 * The deploy with the latest creation time of a list answer, null for an empty list, undefined for an invalid one.
 * The reference of Render does not give the order of the list, so the creation time decides.
 */
export function newestDeployOf(json: unknown): PlatformDeploy | null | undefined {
  if (!Array.isArray(json)) return undefined;
  const deploys = json.map((item) => deployOf(recordOf(item).deploy));
  if (!deploys.every((deploy) => deploy !== undefined)) return undefined;
  const newest = deploys.reduce<DatedDeploy | null>((latest, deploy) => latest === null || deploy.createdAt > latest.createdAt ? deploy : latest, null);
  return newest === null ? null : undated(newest);
}

/** The deploy of a deploy answer, such as the 201 of a deploy call, or undefined for an invalid one. */
export function deployOfAnswer(json: unknown): PlatformDeploy | undefined {
  const dated = deployOf(json);
  return dated === undefined ? undefined : undated(dated);
}

function undated({ createdAt: _createdAt, ...deploy }: DatedDeploy): PlatformDeploy {
  return deploy;
}

// A deploy without a valid ID or status makes the list invalid, because then no deploy is surely the newest. A deploy
// without a valid creation time sorts as the oldest.
function deployOf(value: unknown): DatedDeploy | undefined {
  const { id, status, image, createdAt } = recordOf(value);
  if (typeof id !== 'string' || !DEPLOY_ID.test(id) || typeof status !== 'string') return undefined;
  const { sha } = recordOf(image);
  const created = typeof createdAt === 'string' ? Date.parse(createdAt) : Number.NaN;
  return {
    id, status, progress: progressOf(status),
    ...(typeof sha === 'string' && DIGEST.test(sha) ? { imageDigest: sha } : {}),
    createdAt: Number.isNaN(created) ? -Infinity : created,
  };
}

// Each other status is a step on the way to live, so it is pending: the 15 minutes of the deploy watch bound it.
function progressOf(status: string): DeployProgress {
  if (status === 'live') return 'live';
  return FAILED_STATUSES.has(status) ? 'failed' : 'pending';
}
