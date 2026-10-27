// The deploy request of a manual dispatch of .github/workflows/hosted-image.yml, read from the environment of the
// deploy job. Each rule holds before any registry or Render call, so a refused request reaches no service.

export const IMAGE = 'ghcr.io/tomer-mayara/thermus-hosted';
const PRODUCTION_SERVICE_ID = 'srv-db8mnqg473hc739d529g';
const RELEASE_REF = 'refs/heads/main';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SERVICE_ID = /^srv-[a-z0-9]{1,60}$/;

export interface DeployRequest {
  readonly digest: string;
  readonly serviceId: string;
  readonly imageUrl: string;
}

export type RequestResult =
  | { readonly request: DeployRequest; readonly problems?: undefined }
  | { readonly request?: undefined; readonly problems: readonly string[] };

type Environment = Readonly<Record<string, string | undefined>>;

export function parseDeployRequest(environment: Environment): RequestResult {
  const digest = environment.DIGEST ?? '';
  const serviceId = environment.SERVICE_ID ?? '';
  const problems = [
    refProblem(environment.GITHUB_REF),
    digestProblem(digest),
    serviceProblem(serviceId),
    confirmationProblem(serviceId, environment.CONFIRM_PRODUCTION ?? ''),
  ].filter((problem) => problem !== undefined);
  if (problems.length > 0) return { problems };
  return { request: { digest, serviceId, imageUrl: `${IMAGE}@${digest}` } };
}

// A dispatch on another branch runs the workflow and the script of that branch, so only main deploys.
function refProblem(ref: string | undefined): string | undefined {
  if (ref === RELEASE_REF) return undefined;
  return `A deploy runs only from main, and this run is on ${ref ?? 'no ref'}. Dispatch the workflow on main.`;
}

function digestProblem(digest: string): string | undefined {
  if (digest === '') return 'The input digest is empty. Give the digest of an image that a run of this workflow pushed, sha256:<64 hex characters>.';
  return DIGEST.test(digest) ? undefined : 'The input digest is not sha256:<64 lowercase hex characters>.';
}

function serviceProblem(serviceId: string): string | undefined {
  if (serviceId === '') return 'The input service_id is empty. Give the ID of a Render web service, srv-<ID>.';
  return SERVICE_ID.test(serviceId) ? undefined : 'The input service_id is not srv-<lowercase letters and digits>.';
}

// The production service needs its ID a second time, so that a mistyped or a copied ID cannot deploy production.
function confirmationProblem(serviceId: string, confirmation: string): string | undefined {
  if (serviceId === PRODUCTION_SERVICE_ID) {
    if (confirmation === PRODUCTION_SERVICE_ID) return undefined;
    return `${PRODUCTION_SERVICE_ID} is the production service. A deploy there also needs the input confirm_production with that same service ID.`;
  }
  if (confirmation === '') return undefined;
  return `The input confirm_production is only for the production service ${PRODUCTION_SERVICE_ID}, and it must repeat service_id. Leave it empty for another service.`;
}
