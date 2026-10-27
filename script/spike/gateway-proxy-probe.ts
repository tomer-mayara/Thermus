#!/usr/bin/env node
// SO-01d part one: a local model of the MCP gateway of the self on-boarding plan, sections 4.1 and 4.2. One process
// starts three parts on loopback ports: the stand-in tenant upstream, the proxy, and an MCP client, in
// gateway-proxy/upstream.ts, proxy.ts, and client.ts. The upstream accepts only a Thermus-Access header with a valid
// Ed25519 signature (gateway-proxy/access-context.ts); both listeners use gateway-proxy/http-bridge.ts. Each step of
// gateway-proxy/steps.ts asserts one Given-When-Then specification. At the end, the script prints one Markdown table
// of the measured times and one conclusion for each step. This is a probe, not production code.
// Run it from the repository root: node script/spike/gateway-proxy-probe.ts
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { probeContext, signAccess } from './gateway-proxy/access-context.ts';
import { connectClient, newClient, PROTOCOL_VERSION } from './gateway-proxy/client.ts';
import { startProxy } from './gateway-proxy/proxy.ts';
import { cleanupStep, messageOf, partSteps, type Parts, type ProbeStep, type Report } from './gateway-proxy/steps.ts';
import { startUpstream } from './gateway-proxy/upstream.ts';

type Closer = () => Promise<void>;

async function startParts(closers: Closer[]): Promise<Parts> {
  const gateway = generateKeyPairSync('ed25519');
  const keys = { gateway, other: generateKeyPairSync('ed25519') };
  const upstream = await startUpstream(gateway.publicKey);
  closers.push(() => upstream.close());
  const proxy = await startProxy(new URL('/mcp', upstream.url), () => signAccess(probeContext(), gateway.privateKey));
  closers.push(() => proxy.close());
  const client = newClient();
  closers.push(() => client.close());
  await connectClient(client, proxy.url);
  assert.equal(client.getNegotiatedProtocolVersion(), PROTOCOL_VERSION, 'The client must negotiate the pinned protocol version');
  return { keys, upstream, proxy, client };
}

async function check(step: ProbeStep, parts: Parts, report: Report): Promise<void> {
  process.stderr.write(`gateway-proxy-probe: ${step.name}: ${step.spec}\n`);
  try {
    report.conclusions.push(`- PASS ${step.name}: ${await step.run(parts, report)}`);
  } catch (error) {
    throw new Error(`${step.name}: ${messageOf(error)}`, { cause: error });
  }
}

async function closeAll(closers: Closer[]): Promise<unknown> {
  let failure: unknown;
  for (const close of closers.reverse()) {
    try {
      await close();
    } catch (error) {
      failure ??= error;
    }
  }
  return failure;
}

async function runProbe(report: Report): Promise<void> {
  const closers: Closer[] = [];
  let parts: Parts | undefined;
  let failure: unknown;
  try {
    parts = await startParts(closers);
    for (const step of partSteps) await check(step, parts, report);
  } catch (error) {
    failure = parts === undefined ? new Error(`Setup: ${messageOf(error)}`, { cause: error }) : error;
  }
  const closeFailure = await closeAll(closers);
  if (failure !== undefined) throw failure;
  if (closeFailure !== undefined) throw new Error(`Cleanup: ${messageOf(closeFailure)}`, { cause: closeFailure });
  assert.ok(parts !== undefined);
  await check(cleanupStep, parts, report);
}

function renderReport(report: Report): string {
  const versions = `Node ${process.version}, @modelcontextprotocol/server ${sdkVersion('@modelcontextprotocol/server')}, @modelcontextprotocol/client ${sdkVersion('@modelcontextprotocol/client')}, protocol ${PROTOCOL_VERSION}`;
  return [
    '## Gateway proxy probe', '',
    `${versions}. Times are milliseconds after the start of each call, on one clock; a "+" time is after the client abort.`, '',
    '| Part | Event | Expected | Measured |', '| --- | --- | --- | --- |',
    ...report.rows.map((row) => `| ${row.part} | ${row.event} | ${row.expected} | ${row.measured} |`), '',
    '### Conclusions', '', ...report.conclusions, '',
  ].join('\n');
}

function sdkVersion(name: string): string {
  const entry = pathToFileURL(createRequire(import.meta.url).resolve(name));
  const manifest = JSON.parse(readFileSync(new URL('../package.json', entry), 'utf8')) as { version?: unknown };
  return typeof manifest.version === 'string' ? manifest.version : 'unknown';
}

async function main(): Promise<number> {
  const report: Report = { rows: [], conclusions: [] };
  try {
    await runProbe(report);
  } catch (error) {
    process.stderr.write(`gateway-proxy-probe: FAIL ${messageOf(error)}\n`);
    return 1;
  }
  process.stdout.write(renderReport(report));
  return 0;
}

function failIfAHandleKeepsTheProcessAlive(): void {
  setTimeout(() => {
    process.stderr.write('gateway-proxy-probe: FAIL Cleanup: the process did not exit within 5 s; a handle is still open\n');
    process.exit(1);
  }, 5_000).unref();
}

process.exitCode = await main();
failIfAHandleKeepsTheProcessAlive();
