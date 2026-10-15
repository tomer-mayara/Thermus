// The auth WorkOS MCP URL fetch work slice: a manual run of the hosted edition with the real WorkOS provider, the fetch
// tool, and Axiom logs, not a test. See README.md here.
// This file is the entry point of the slice and also exports its composition for the tests. It runs only when it is
// executed directly, with the guard of src/index.ts, so that the tests can import it.
// Start it with the launcher auth-workos-mcp-url-fetch.sh in this folder, through the staging launcher of README.md.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Application, ApplicationLogger, RouteConfig } from '../../../../src/application.ts';
import { loadDeploymentConfig } from '../../../../src/config/deployment-config.ts';
import { createFetchOperation, fetchToolServers } from '../../../../src/fetch-tool.ts';
import { composeWorkOSApplication, openWorkOSConnection, type WorkOSConnection } from '../../../../src/hosted-workos-application.ts';
import { stopSignal } from '../../../../src/index.ts';
import { ConsoleLogger } from '../../../../src/logging/console-logger.ts';
import { axiomTestSettings, openAxiomLogging } from '../../../support/in-process/axiom-test-export.ts';
import { LocalHttpsSite } from '../../../support/hosted-live/local-https-site.ts';
import { connectScope, localOrigin } from '../../../support/hosted-live/settings.ts';
import { observeFetches } from '../../../support/work-slice/observe-fetches.ts';
import { assertPinnedRenderer } from '../../../support/work-slice/pinned-renderer.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface WorkSliceParts {
  readonly config: RouteConfig;
  readonly connection: WorkOSConnection;
  readonly environment: Environment;
}

interface TlsFiles {
  readonly key: Buffer;
  readonly cert: Buffer;
  readonly certificateFile: string;
}

const launcher = 'test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh';
const clientName = 'thermus-hosted';
const axiomDatasetPage = 'https://app.axiom.co/thermus-ai-spao/datasets/system-log-test';

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(new ConsoleLogger());
}

// Production composes the hosted edition without a tool, so this is the composition root of the slice. The fetch tool, its full URL
// and Markdown log lines, and the fixed verified-Google onboarding policy belong to this slice.
export async function composeWorkSliceApplication(parts: WorkSliceParts, logger: ApplicationLogger): Promise<Application> {
  const { config, connection, environment } = parts;
  const organizationId = environment.THERMUS_SLICE_ORGANIZATION_ID?.trim();
  if (!organizationId) throw new Error('Set THERMUS_SLICE_ORGANIZATION_ID to the WorkOS organization of this slice');
  const operation = observeFetches(createFetchOperation(environment, logger), logger);
  return composeWorkOSApplication(config, connection, { logger, buildServer: fetchToolServers(operation, logger), onboarding: { organizationId } });
}

async function run(consoleLog: ConsoleLogger): Promise<number> {
  try {
    await serveWorkSlice();
    return 0;
  } catch (error) {
    consoleLog.fatal(error);
    return 1;
  }
}

// The stack closes the HTTPS site first, then the logging, so that Axiom gets the lines of the stop.
async function serveWorkSlice(): Promise<void> {
  const config = loadDeploymentConfig(process.env, 'http');
  assertSliceOrigin(config.publicBaseUrl);
  await assertPinnedRenderer(process.env.LIGHTPANDA_BIN);
  const tls = await readTlsFiles(process.env.THERMUS_TLS_DIR);
  const scopeName = `thermus-work-slice-${randomUUID()}`;
  await using owned = new AsyncDisposableStack();
  const { logger } = owned.adopt(openAxiomLogging(axiomTestSettings(), scopeName), (opened) => opened.close());
  const connection = await openWorkOSConnection(config, logger, process.env);
  const { apiKey, clientId, authkitIssuer } = connection.settings;
  owned.adopt(await LocalHttpsSite.start({ apiKey, clientId, authkitIssuer }, {
    certificate: { key: tls.key, cert: tls.cert },
    logger,
    application: (applicationLogger) => composeWorkSliceApplication({ config, connection, environment: process.env }, applicationLogger),
  }), (site) => site.close());
  logger.info(`Listening on ${config.publicBaseUrl}`);
  // A person can press Ctrl+C as soon as the instructions appear, so the stop handlers come first.
  using stopped = stopSignal(process);
  process.stdout.write(instructions(config, tls.certificateFile, scopeName));
  const signal = await stopped.received;
  logger.info(`Stopping after ${signal}`);
}

// The check also refuses a path, because the portal and the WorkOS URIs are at the root of the origin.
function assertSliceOrigin(publicBaseUrl: string): void {
  if (publicBaseUrl !== `${localOrigin}/`) {
    throw new Error(`PUBLIC_BASE_URL must be ${localOrigin} for this work slice: the HTTPS front of the slice listens at that origin, and the WorkOS environment has its URIs.`);
  }
}

async function readTlsFiles(directory: string | undefined): Promise<TlsFiles> {
  if (directory === undefined || directory === '') {
    throw new Error(`Set THERMUS_TLS_DIR to the directory of key.pem and cert.pem. The launcher ${launcher} sets it and makes the files.`);
  }
  const read = async (name: string): Promise<Buffer> => {
    const file = resolve(directory, name);
    try {
      return await readFile(file);
    } catch (cause) {
      throw new Error(`The TLS file ${file} cannot be read. The launcher ${launcher} makes key.pem and cert.pem when they are missing.`, { cause });
    }
  };
  return { key: await read('key.pem'), cert: await read('cert.pem'), certificateFile: resolve(directory, 'cert.pem') };
}

function instructions(config: RouteConfig, certificateFile: string, scopeName: string): string {
  const clientConfig = JSON.stringify({ type: 'http', url: config.mcpResourceUrl, oauth: { scopes: connectScope } });
  return [
    '',
    `Portal: ${config.publicBaseUrl}`,
    `MCP endpoint: ${config.mcpResourceUrl}`,
    '',
    '1. Trust the certificate of the slice in the browser one time. macOS asks for your password:',
    `  security add-trusted-cert -r trustRoot -k ~/Library/Keychains/login.keychain-db "${certificateFile}"`,
    '',
    `2. Open ${config.publicBaseUrl}, click Sign In, and click "Continue with Google". Sign in with your Google account.`,
    '   Use your verified @thermus.ai Google account. A new eligible user gets User access in the configured',
    '   slice organization. The portal selects that organization and shows product access.',
    '',
    '3. An existing membership keeps its roles and status. A removed User grant, inactive or pending membership,',
    '   unverified address, another domain, or another sign-in method gets no automatic grant.',
    '',
    '4. Connect Claude Code. Claude Code must trust the certificate for the OAuth and MCP requests:',
    `  export NODE_EXTRA_CA_CERTS="${certificateFile}"`,
    '   Run the next command in the directory where you start Claude Code, or add --scope user:',
    `  claude mcp add-json ${clientName} '${clientConfig}'`,
    `  claude mcp login ${clientName}`,
    '   The browser opens the consent page of AuthKit. Select the slice organization and click "Allow access".',
    '   This separate Connect OAuth flow gives the MCP client its own token; the browser session is for the portal.',
    '',
    '5. Start a new Claude Code session with the same NODE_EXTRA_CA_CERTS, and ask, for example:',
    `  Use the ${clientName} tool getURLAsMarkdown to read https://example.com/ and tell me its title.`,
    '',
    `Watch the log in Axiom: ${axiomDatasetPage}`,
    `Scope name of this run: ${scopeName}`,
    'APL filter:',
    `  ['system-log-test'] | where ['scope.name'] == "${scopeName}" | sort by _time asc`,
    'If the filter finds nothing, use this search:',
    `  ['system-log-test'] | search "work-slice fetch"`,
    '',
    'The slice runs. The log goes to Axiom only. A FATAL line here means that the slice failed.',
    'Stop with Ctrl+C. Then remove the client entry:',
    `  claude mcp remove ${clientName}`,
    '',
  ].join('\n');
}
