import { isAbsolute } from 'node:path';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/server';
import { readAdRulesFile } from '../../../src/config/ad-rules-file.ts';
import { loadListenAddress, type ListenAddress } from '../../../src/config/deployment-config.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface WorkSliceSettings {
  readonly listen: ListenAddress;
  readonly publicBaseUrl: string;
  readonly mcpResourceUrl: string;
  readonly resourceMetadataUrl: string;
  readonly lightpandaBin: string;
  readonly adRules: string;
}

// Each message names the setting and the rule. It does not show the value.
export class WorkSliceSettingsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkSliceSettingsError';
  }
}

export function readWorkSliceSettings(environment: Environment): WorkSliceSettings {
  const listen = readListenAddress(environment);
  const base = readPublicBaseUrl(environment, listen);
  const mcpResource = new URL('mcp', base);
  const settings: WorkSliceSettings = {
    listen,
    publicBaseUrl: base.href,
    mcpResourceUrl: mcpResource.href,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpResource),
    lightpandaBin: readLightpandaBin(environment),
    adRules: readAdRules(environment),
  };
  return Object.freeze(settings);
}

function readListenAddress(environment: Environment): ListenAddress {
  const listen = loadListenAddress(environment);
  if (listen.port === 0) {
    throw new WorkSliceSettingsError('LISTEN_PORT must not be 0 for the work slice: the client URL must be known before the server listens.');
  }
  return listen;
}

function readPublicBaseUrl(environment: Environment, listen: ListenAddress): URL {
  const text = environment.PUBLIC_BASE_URL;
  const base = text === undefined || text === '' ? defaultBaseUrl(listen) : parsePublicBaseUrl(text);
  if (!base.pathname.endsWith('/')) base.pathname = `${base.pathname}/`;
  return base;
}

function defaultBaseUrl({ host, port }: ListenAddress): URL {
  const name = host.includes(':') ? `[${host}]` : host;
  return new URL(`http://${name}:${port}/`);
}

// The URL parser removes an empty query or fragment, so the checks read the text.
function parsePublicBaseUrl(text: string): URL {
  const url = URL.parse(text);
  if (url === null) throw new WorkSliceSettingsError('PUBLIC_BASE_URL must be an absolute URL.');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new WorkSliceSettingsError('PUBLIC_BASE_URL must use http or https.');
  if (url.username !== '' || url.password !== '') {
    throw new WorkSliceSettingsError('PUBLIC_BASE_URL must not contain a username or password.');
  }
  if (text.includes('?')) throw new WorkSliceSettingsError('PUBLIC_BASE_URL must not contain a query.');
  if (text.includes('#')) throw new WorkSliceSettingsError('PUBLIC_BASE_URL must not contain a fragment.');
  return url;
}

function readLightpandaBin(environment: Environment): string {
  const executable = environment.LIGHTPANDA_BIN;
  if (executable === undefined || executable === '') {
    throw new WorkSliceSettingsError('LIGHTPANDA_BIN is required. Set it to the absolute path of the pinned Lightpanda 1.0.0 executable. See docs/lightpanda-runtime.md.');
  }
  if (!isAbsolute(executable)) throw new WorkSliceSettingsError('LIGHTPANDA_BIN must be an absolute path.');
  return executable;
}

function readAdRules(environment: Environment): string {
  const file = environment.AD_RULES_FILE;
  if (file === undefined || file === '') return '';
  return readAdRulesFile(environment);
}
