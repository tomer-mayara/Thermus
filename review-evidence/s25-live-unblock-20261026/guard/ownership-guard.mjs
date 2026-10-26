import { createHash } from 'node:crypto';

const kinds = ['application', 'user', 'organization'];
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const statusOf = error => Number.isInteger(error?.status) ? error.status : Number.isInteger(error?.statusCode) ? error.statusCode : null;

// Wrap SDK prototypes only. Every allowed call keeps its receiver and arguments.
export function installGuard(sdk, clientId, journal, prior = []) {
  const owned = new Map(kinds.map(kind => [kind, new Set()]));
  const remember = (kind, id) => {
    if (!validId(id)) throw new Error('Ownership guard refused an invalid resource ID.');
    owned.get(kind).add(id);
  };
  for (const row of prior) {
    if (['created', 'personal-adopted'].includes(row.event) && kinds.includes(row.kind)) remember(row.kind, row.id);
  }
  const restores = [];
  function wrap(target, method, implementation) {
    const prototype = Object.getPrototypeOf(target);
    const original = prototype[method];
    if (typeof original !== 'function') throw new Error('Ownership guard SDK method is missing.');
    prototype[method] = implementation(original);
    restores.push(() => { prototype[method] = original; });
  }
  const sections = [
    ['application', sdk.connect, 'createApplication', 'deleteApplication', argument => argument?.id],
    ['user', sdk.userManagement, 'createUser', 'deleteUser', argument => argument],
    ['organization', sdk.organizations, 'createOrganization', 'deleteOrganization', argument => argument],
  ];
  for (const [kind, target, create, remove, deletionId] of sections) {
    wrap(target, create, original => async function (...args) {
      const result = await original.apply(this, args);
      remember(kind, result?.id);
      journal({ event: 'created', kind, id: result.id });
      return result;
    });
    wrap(target, remove, original => async function (...args) {
      const id = deletionId(args[0]);
      if (!validId(id) || !owned.get(kind).has(id)) {
        journal({ event: 'delete-denied', kind, ...(validId(id) ? { id } : {}) });
        throw new Error('Ownership guard blocked deletion of a resource outside this run.');
      }
      journal({ event: 'delete-started', kind, id });
      try {
        const result = await original.apply(this, args);
        journal({ event: 'delete-complete', kind, id });
        return result;
      } catch (error) {
        journal({ event: 'delete-failed', kind, id, status: statusOf(error) });
        throw error;
      }
    });
  }
  wrap(sdk.organizations, 'getOrganizationByExternalId', original => async function (...args) {
    const result = await original.apply(this, args);
    const subject = result?.metadata?.subject;
    const schema = result?.metadata?.schema;
    if (owned.get('user').has(subject) && ['thermus-signup-v1', 'thermus-signup-v2'].includes(schema)) {
      const expected = 'thermus-signup:' + createHash('sha256').update(`workos:${clientId}`).update('\0').update(subject).digest('base64url');
      if (args[0] === expected && result.externalId === expected) {
        remember('organization', result.id);
        journal({ event: 'personal-adopted', kind: 'organization', id: result.id, subject });
      }
    }
    return result;
  });
  return () => { for (const restore of restores.reverse()) restore(); };
}
