import { DeploymentConfigError } from './deployment-config.ts';

type Environment = Readonly<Record<string, string | undefined>>;

/** The export of the system log of the control plane to an OTLP/HTTP logs endpoint (plan section 4.1, SO-11a). */
export interface SystemLogExportSettings {
  // The https URL of the logs endpoint: for Axiom, https://<edge deployment domain>/v1/logs.
  readonly endpoint: string;
  // The bearer token. It is a secret of the control plane, which the tenant role refuses (D-14).
  readonly token: string;
  // The Axiom dataset, sent in the header X-Axiom-Dataset. A collector that is not Axiom needs none.
  readonly dataset?: string;
  // RENDER_INSTANCE_ID, which Render sets for each instance of a service.
  readonly instanceId?: string;
}

// The three settings, and the instance name that Render sets.
const NAMES = ['SYSTEM_LOG_OTLP_ENDPOINT', 'SYSTEM_LOG_OTLP_TOKEN', 'SYSTEM_LOG_AXIOM_DATASET', 'RENDER_INSTANCE_ID'] as const;
const ENDPOINT_RULE = 'SYSTEM_LOG_OTLP_ENDPOINT must be the https URL of an OTLP/HTTP logs endpoint, such as https://us-east-1.aws.edge.axiom.co/v1/logs, without spaces, a username, a password, a query, or a fragment.';
// https, a host without a username or a password, and a path, with no query, fragment, space, or control character.
const HTTPS_ENDPOINT = /^https:\/\/[^\s\p{Cc}/?#@]+(?:\/[^\s\p{Cc}?#]*)?$/u;
const SPACE_OR_CONTROL = /[\s\p{Cc}]/u;
// The dataset name rule of the audit destination settings (src/logs/audit/destination-settings-service.ts).
const DATASET_NAME = /^[A-Za-z0-9-]{1,128}$/;

/**
 * Undefined when the three settings are empty: then the system log goes to standard error only. The endpoint and the
 * token come together. An error names the setting and its rule, but never its value.
 */
export function loadSystemLogExportSettings(environment: Environment): SystemLogExportSettings | undefined {
  const [endpoint, token, dataset, instanceId] = NAMES.map((name) => environment[name] || '');
  if ([endpoint, token, dataset].every((value) => value === '')) return undefined;
  return Object.freeze({
    endpoint: endpointOf(endpoint),
    token: tokenOf(token),
    ...optional('dataset', datasetOf(dataset)),
    ...optional('instanceId', instanceId),
  });
}

function endpointOf(value: string): string {
  if (value === '') throw new DeploymentConfigError('SYSTEM_LOG_OTLP_ENDPOINT is required when SYSTEM_LOG_OTLP_TOKEN or SYSTEM_LOG_AXIOM_DATASET is set.');
  if (!HTTPS_ENDPOINT.test(value) || URL.parse(value) === null) throw new DeploymentConfigError(ENDPOINT_RULE);
  return value;
}

function tokenOf(value: string): string {
  if (value === '') throw new DeploymentConfigError('SYSTEM_LOG_OTLP_TOKEN is required when SYSTEM_LOG_OTLP_ENDPOINT or SYSTEM_LOG_AXIOM_DATASET is set.');
  // The token goes into a request header.
  if (SPACE_OR_CONTROL.test(value)) throw new DeploymentConfigError('SYSTEM_LOG_OTLP_TOKEN must not contain spaces or control characters.');
  return value;
}

function datasetOf(value: string): string {
  if (value !== '' && !DATASET_NAME.test(value)) throw new DeploymentConfigError('SYSTEM_LOG_AXIOM_DATASET must have 1 to 128 letters, digits, or hyphens.');
  return value;
}

function optional<Name extends 'dataset' | 'instanceId'>(name: Name, value: string): Partial<Record<Name, string>> {
  return value === '' ? {} : { [name]: value } as Partial<Record<Name, string>>;
}
