import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { promisify } from 'node:util';
import type { AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import type { AuditDestination, AuditSendOutcome } from '../../../src/logs/audit/audit-send.ts';
import { auditSenderRuntime } from '../processes/module-paths.ts';
import { docker, dockerOutput } from './docker-cli.ts';

const nodeImage = 'node:24.20.0-bookworm-slim';
const collectorImage = 'otel/opentelemetry-collector-contrib:0.163.2@sha256:7f22d2a6748110ffb6a59bc0df448bccbf501cdb667d610ede4c61d3863d5849';
const exec = promisify(execFile);
const token = 'audit-runtime-only-token';

interface Submission extends AuditDestination {
  readonly event: AuditEvent;
  readonly resolveTo?: string;
  readonly cancelAfterMs?: number;
}

interface ReceivedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
  readonly localAddress: string;
  readonly servername: string;
}

interface ExportedRecord { readonly timeUnixNano: string }

function command(args: readonly string[]): Promise<string> {
  return dockerOutput(args, { signal: AbortSignal.timeout(90_000) });
}

async function createNetwork(name: string): Promise<string> {
  // Docker rejects overlap. An internal bridge cannot route these test addresses to the Internet.
  for (const subnet of ['93.184.216', '93.184.215', '93.184.214']) {
    const result = await docker(['network', 'create', '--internal', '--subnet', `${subnet}.0/24`, name], { signal: AbortSignal.timeout(15_000) });
    if (result.code !== 0) {
      if (result.stderr.includes('overlap')) continue;
      throw new Error(`The audit fixture network failed: ${result.stderr}`);
    }
    const internal = await command(['network', 'inspect', name, '--format', '{{.Internal}}']);
    if (internal !== 'true') throw new Error('The audit fixture must have an internal network.');
    return `${subnet}.10`;
  }
  throw new Error('No isolated audit fixture subnet is free.');
}

async function prepareFiles(directory: string): Promise<void> {
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(directory, 'server.key'), '-out', join(directory, 'server.crt'), '-days', '1', '-subj', '/CN=collector.audit.test', '-addext', 'subjectAltName=DNS:collector.audit.test'], { timeout: 15_000 });
  // These keys are disposable fixture data, not credentials for a service.
  await chmod(directory, 0o755);
  await chmod(join(directory, 'server.key'), 0o644);
  await mkdir(join(directory, 'output'));
  await chmod(join(directory, 'output'), 0o777);
  await writeFile(join(directory, 'requests.ndjson'), '');
  await writeFile(join(directory, 'package.json'), '{"type":"module"}');
  await mkdir(join(directory, 'app/src/logs'), { recursive: true });
  await mkdir(join(directory, 'app/test/support/processes'), { recursive: true });
  await mkdir(join(directory, 'app/test/support/container'), { recursive: true });
  await cp(join(auditSenderRuntime.source, 'logs/audit'), join(directory, 'app/src/logs/audit'), { recursive: true });
  await cp(join(auditSenderRuntime.support, `processes/audit-sender-probe.${auditSenderRuntime.extension}`), join(directory, `app/test/support/processes/audit-sender-probe.${auditSenderRuntime.extension}`));
  await cp(join(auditSenderRuntime.support, `container/audit-tls-receiver.${auditSenderRuntime.extension}`), join(directory, `app/test/support/container/audit-tls-receiver.${auditSenderRuntime.extension}`));
  await cp(join(directory, 'package.json'), join(directory, 'app/package.json'));
}

function collectorConfig(): string {
  return `extensions:
  bearertokenauth:
    token: ${token}
receivers:
  otlp/none:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
        tls:
          cert_file: /fixture/server.crt
          key_file: /fixture/server.key
  otlp/bearer:
    protocols:
      http:
        endpoint: 0.0.0.0:4319
        tls:
          cert_file: /fixture/server.crt
          key_file: /fixture/server.key
        auth:
          authenticator: bearertokenauth
exporters:
  file:
    path: /fixture/output/audit.ndjson
    flush_interval: 50ms
service:
  extensions: [bearertokenauth]
  telemetry:
    logs:
      level: info
  pipelines:
    logs:
      receivers: [otlp/none, otlp/bearer]
      exporters: [file]
`;
}

async function waitUntilReady(container: string, kind: 'receiver' | 'collector'): Promise<void> {
  const expected = kind === 'receiver' ? 'Audit TLS receiver ready' : 'Everything is ready';
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const logs = await docker(['logs', container], { signal: AbortSignal.timeout(5_000) });
    if (`${logs.stdout.toString('utf8')}${logs.stderr}`.includes(expected)) return;
    const running = await command(['inspect', container, '--format', '{{.State.Running}}']);
    if (running !== 'true') throw new Error(`The audit fixture stopped before readiness: ${logs.stderr}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The audit fixture did not become ready.');
}

async function cleanupResources(containers: readonly string[], network: string): Promise<void> {
  const signal = AbortSignal.timeout(15_000);
  const remove = async (args: readonly string[]): Promise<string | undefined> => {
    try {
      const result = await docker(args, { signal });
      if (result.code === 0 || /No such container|not found/.test(result.stderr)) return;
      return result.stderr;
    } catch {
      return `Cleanup did not finish for ${args.at(-1)}.`;
    }
  };
  const errors = await Promise.all(containers.map((container) => remove(['rm', '-f', container])));
  errors.push(await remove(['network', 'rm', network]));
  const failed = errors.filter((error) => error !== undefined);
  if (failed.length > 0) throw new Error(`Audit fixture cleanup failed: ${failed.join('\n')}`);
}

/** Runs the real sender and TLS policy on public-shaped addresses in an isolated Docker bridge. */
export async function openAuditSenderSite(t: TestContext, kind: 'receiver' | 'collector') {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-audit-'));
  const network = `thermus-audit-${randomUUID()}`;
  const containers: string[] = [];
  t.after(async () => {
    try {
      await cleanupResources(containers, network);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  const address = await createNetwork(network);
  await prepareFiles(directory);
  await writeFile(join(directory, 'collector.yaml'), collectorConfig());
  const receiver = `${network}-${kind}`;
  containers.push(receiver);
  const launch = kind === 'collector'
    ? [collectorImage, '--config=/fixture/collector.yaml']
    : [nodeImage, 'node', `/fixture/app/test/support/container/audit-tls-receiver.${auditSenderRuntime.extension}`];
  await command(['create', '--name', receiver, '--network', network, '--ip', address, ...launch]);
  await command(['cp', directory, `${receiver}:/fixture`]);
  await command(['start', receiver]);
  await waitUntilReady(receiver, kind);

  async function copiedFile(path: string): Promise<string> {
    const target = join(directory, `read-${randomUUID()}`);
    await command(['cp', `${receiver}:${path}`, target]);
    return readFile(target, 'utf8');
  }

  return {
    address, token, collectorImage,
    endpoint: 'https://collector.audit.test:4318/v1/logs',
    bearerEndpoint: 'https://collector.audit.test:4319/v1/logs',
    async send(submissions: readonly Submission[], options: { trustCertificate?: boolean } = {}): Promise<AuditSendOutcome[]> {
      const client = `${network}-client-${containers.length}`;
      containers.push(client);
      await writeFile(join(directory, 'submissions.json'), JSON.stringify(submissions));
      const trust = options.trustCertificate === false ? [] : ['-e', 'NODE_EXTRA_CA_CERTS=/fixture/server.crt'];
      await command(['create', '--name', client, '--network', network,
        '--add-host', `collector.audit.test:${address}`, '--add-host', `wrong.audit.test:${address}`,
        ...trust,
        '-e', 'OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer platform-secret,X-System=internal',
        '-e', 'OTEL_EXPORTER_OTLP_LOGS_HEADERS=X-Axiom-Dataset=system-only',
        '-e', 'OTEL_EXPORTER_OTLP_ENDPOINT=https://system.audit.test:1',
        '-e', 'NODE_TLS_REJECT_UNAUTHORIZED=0', '-e', 'NODE_USE_ENV_PROXY=1', '-e', 'HTTPS_PROXY=http://127.0.0.1:1',
        nodeImage, 'node', `/fixture/app/test/support/processes/audit-sender-probe.${auditSenderRuntime.extension}`]);
      await command(['cp', directory, `${client}:/fixture`]);
      const result = await command(['start', '-a', client]);
      const exitCode = await command(['inspect', client, '--format', '{{.State.ExitCode}}']);
      if (exitCode !== '0') throw new Error(`The audit sender probe exited with ${exitCode}.`);
      return JSON.parse(result);
    },
    async requests(): Promise<ReceivedRequest[]> {
      const content = await copiedFile('/fixture/requests.ndjson');
      return content.trim() === '' ? [] : content.trim().split('\n').map((line) => JSON.parse(line));
    },
    async collectorRecords(count: number): Promise<ExportedRecord[]> {
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const content = await copiedFile('/fixture/output/audit.ndjson');
        const batches = content.trim() === '' ? [] : content.trim().split('\n').map((line) => JSON.parse(line));
        const records = batches.flatMap((batch) => batch.resourceLogs.flatMap((resource: { scopeLogs: { logRecords: ExportedRecord[] }[] }) => resource.scopeLogs.flatMap((scope) => scope.logRecords)));
        if (records.length >= count) return records;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error('The Collector did not export the audit records in time.');
    },
  };
}
