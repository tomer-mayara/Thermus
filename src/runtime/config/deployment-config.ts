import type { KeyObject } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/server';
import { readTenantSettings } from './tenant-settings.ts';

type Environment = Readonly<Record<string, string | undefined>>;
type Deployment = DeploymentConfig['deployment'];

export interface PublicUrls {
  readonly publicBaseUrl: string;
  readonly mcpResourceUrl: string;
  readonly resourceMetadataUrl: string;
}

interface SelfHostedConfig extends PublicUrls {
  readonly deployment: 'self-hosted';
  readonly dataDirectory: string;
}

// The control plane, THERMUS_ROLE=control-plane or no THERMUS_ROLE. The hosted provider will read and check its own
// settings, so no WORKOS_* value can change this record.
interface HostedConfig extends PublicUrls {
  readonly deployment: 'hosted';
  readonly role: 'control-plane';
}

// The settings of THERMUS_ROLE=tenant (plan section 4.1). A tenant holds no secret: only public keys and addresses.
export interface TenantSettings {
  readonly organizationId: string;
  // The Ed25519 public keys of the gateway. A context of any of them verifies, for a key rotation.
  readonly gatewayPublicKeys: readonly KeyObject[];
  // The origin of the control plane on the private network, with a final slash. The audit relay posts there.
  readonly controlPlaneInternalUrl: string;
  // Exactly as written: Connect access tokens must carry this issuer, and its key set checks them.
  readonly authkitIssuer: string;
}

interface TenantConfig extends PublicUrls {
  readonly deployment: 'hosted';
  readonly role: 'tenant';
  readonly tenant: TenantSettings;
}

export type DeploymentConfig = SelfHostedConfig | HostedConfig | TenantConfig;

export interface ListenAddress {
  readonly host: string;
  readonly port: number;
}

export class DeploymentConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DeploymentConfigError';
  }
}

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const SPACE_OR_CONTROL_CHARACTER = /[\s\p{Cc}]/u;
const DEFAULT_LISTEN_ADDRESS: ListenAddress = { host: '127.0.0.1', port: 8080 };
const MAX_PORT = 65_535;

export function loadDeploymentConfig(environment: Environment, transport: 'http' | 'stdio'): DeploymentConfig {
  const deployment = readDeployment(environment);
  if (deployment === 'self-hosted') return loadSelfHostedConfig(environment);
  if (transport !== 'http') {
    throw new DeploymentConfigError('The hosted DEPLOYMENT serves MCP only over HTTPS, not stdio.');
  }
  return loadHostedConfig(environment);
}

export function loadListenAddress(environment: Environment): ListenAddress {
  const address: ListenAddress = { host: readListenHost(environment), port: readListenPort(environment) };
  return Object.freeze(address);
}

function readListenHost(environment: Environment): string {
  const host = environment.LISTEN_HOST;
  if (host === undefined || host === '') return DEFAULT_LISTEN_ADDRESS.host;
  if (SPACE_OR_CONTROL_CHARACTER.test(host)) {
    throw new DeploymentConfigError('LISTEN_HOST must not contain spaces or control characters.');
  }
  return host;
}

function readListenPort(environment: Environment): number {
  const port = environment.LISTEN_PORT;
  if (port === undefined || port === '') return DEFAULT_LISTEN_ADDRESS.port;
  if (!/^\d{1,5}$/.test(port) || Number(port) > MAX_PORT) {
    throw new DeploymentConfigError(`LISTEN_PORT must be a whole number from 0 to ${MAX_PORT}.`);
  }
  return Number(port);
}

function readDeployment(environment: Environment): Deployment {
  const deployment = environment.DEPLOYMENT;
  if (deployment === 'self-hosted' || deployment === 'hosted') return deployment;
  throw new DeploymentConfigError('DEPLOYMENT must be set to self-hosted or hosted.');
}

function loadSelfHostedConfig(environment: Environment): SelfHostedConfig {
  const config: SelfHostedConfig = {
    deployment: 'self-hosted',
    ...loadPublicUrls(environment, 'self-hosted'),
    dataDirectory: readDataDirectory(environment),
  };
  return Object.freeze(config);
}

function loadHostedConfig(environment: Environment): HostedConfig | TenantConfig {
  if (readRole(environment) === 'tenant') return loadTenantConfig(environment);
  const config: HostedConfig = { deployment: 'hosted', role: 'control-plane', ...loadPublicUrls(environment, 'hosted') };
  return Object.freeze(config);
}

function readRole(environment: Environment): HostedConfig['role'] | TenantConfig['role'] {
  const role = environment.THERMUS_ROLE;
  if (role === undefined || role === '' || role === 'control-plane') return 'control-plane';
  if (role === 'tenant') return role;
  throw new DeploymentConfigError('THERMUS_ROLE must be control-plane or tenant.');
}

// The tenant serves /healthz and /mcp at the root of the public origin, as the control plane serves /mcp.
function loadTenantConfig(environment: Environment): TenantConfig {
  const tenant = readTenantSettings(environment, (message) => { throw new DeploymentConfigError(message); });
  const urls = loadPublicUrls(environment, 'hosted');
  if (new URL(urls.publicBaseUrl).pathname !== '/') throw new DeploymentConfigError('The tenant role requires PUBLIC_BASE_URL with the base path /.');
  const config: TenantConfig = { deployment: 'hosted', role: 'tenant', ...urls, tenant };
  return Object.freeze(config);
}

export function loadPublicUrls(environment: Environment, deployment: Deployment): PublicUrls {
  const base = readPublicBaseUrl(environment, deployment);
  if (!base.pathname.endsWith('/')) base.pathname = `${base.pathname}/`;
  const mcpResource = new URL('mcp', base);
  const urls: PublicUrls = {
    publicBaseUrl: base.href,
    mcpResourceUrl: mcpResource.href,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpResource),
  };
  return Object.freeze(urls);
}

function readPublicBaseUrl(environment: Environment, deployment: Deployment): URL {
  const { text, url } = readUrl(environment, 'PUBLIC_BASE_URL');
  if (deployment === 'hosted') requireHttps(url, 'PUBLIC_BASE_URL');
  else requireHttpsOrLoopbackHttp(url, 'PUBLIC_BASE_URL');
  rejectQuery(text, 'PUBLIC_BASE_URL');
  return url;
}

function readDataDirectory(environment: Environment): string {
  const directory = readRequired(environment, 'DATA_DIR');
  if (!isAbsolute(directory)) throw new DeploymentConfigError('DATA_DIR must be an absolute path.');
  return directory;
}

function readUrl(environment: Environment, name: string): { text: string; url: URL } {
  const text = readRequired(environment, name);
  if (SPACE_OR_CONTROL_CHARACTER.test(text)) {
    throw new DeploymentConfigError(`${name} must not contain spaces or control characters.`);
  }
  const url = URL.parse(text);
  if (url === null) throw new DeploymentConfigError(`${name} must be an absolute URL.`);
  if (url.username !== '' || url.password !== '') {
    throw new DeploymentConfigError(`${name} must not contain a username or password.`);
  }
  if (text.includes('#')) throw new DeploymentConfigError(`${name} must not contain a fragment.`);
  return { text, url };
}

function readRequired(environment: Environment, name: string): string {
  const value = environment[name];
  if (value === undefined || value === '') throw new DeploymentConfigError(`${name} is required.`);
  return value;
}

function requireHttps(url: URL, name: string): void {
  if (url.protocol !== 'https:') throw new DeploymentConfigError(`${name} must use https.`);
}

function requireHttpsOrLoopbackHttp(url: URL, name: string): void {
  if (url.protocol === 'https:') return;
  if (url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname)) return;
  throw new DeploymentConfigError(`${name} must use https. It can use http only on localhost, 127.0.0.1, or [::1].`);
}

function rejectQuery(text: string, name: string): void {
  if (text.includes('?')) throw new DeploymentConfigError(`${name} must not contain a query.`);
}
