import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';

function loadLocalSettings(): NodeJS.ProcessEnv {
  try {
    return parseEnv(readFileSync('.env.local', 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

function axiomLogEndpoint(value: string | undefined): string {
  let endpoint: URL;
  try {
    endpoint = new URL('/v1/logs', value ?? '');
  } catch {
    throw new Error('Set AXOIM_ENDPOINT_URL to an HTTPS Axiom ingestion endpoint.');
  }
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.edge.axiom.co') || endpoint.username || endpoint.password || endpoint.port) {
    throw new Error('AXOIM_ENDPOINT_URL must be an HTTPS Axiom ingestion endpoint.');
  }
  return endpoint.href;
}

export function axiomTestSettings(environment: NodeJS.ProcessEnv = process.env): {
  apiKey: string; endpoint: string; dataset: string;
} {
  if (environment === process.env) environment = { ...loadLocalSettings(), ...environment };
  const apiKey = environment.AXIOM_API_KEY?.trim();
  if (!apiKey) throw new Error('Set AXIOM_API_KEY before running the Axiom logger tests.');
  const endpoint = axiomLogEndpoint(environment.AXOIM_ENDPOINT_URL);
  const dataset = environment.AXIOM_SYSTEM_LOG_TEST_DATA_SET?.trim() || 'system-log-test';
  if (dataset !== 'system-log-test') throw new Error('AXIOM_SYSTEM_LOG_TEST_DATA_SET must be system-log-test.');
  return { apiKey, endpoint, dataset };
}

export function trackTestExports(output: LogRecordExporter): {
  exporter: LogRecordExporter; assertSuccess(): void;
} {
  let started = 0;
  const codes: number[] = [];
  return {
    exporter: {
      export(records, complete) {
        started += 1;
        output.export(records, (result) => {
          codes.push(result.code);
          complete(result.code === 0 ? { code: result.code } : { code: result.code, error: new Error('Axiom rejected the test log export.') });
        });
      },
      forceFlush: () => output.forceFlush(),
      shutdown: () => output.shutdown(),
    },
    assertSuccess() {
      if (started === 0 || codes.length !== started) throw new Error('Axiom did not complete the test log export.');
      if (codes.some((code) => code !== 0)) throw new Error('Axiom rejected the test log export.');
    },
  };
}
