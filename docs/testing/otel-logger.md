# OTel system logger tests

These tests verify `OtelSystemLogSink` in
`src/logs/system/otel-system-log-sink.ts`. The adapter sends
each accepted internal engineering message to a supplied OpenTelemetry logger.
Customers have no access to this stream. These tests do not verify customer
Audit logs, whose event-specific API and destination runtime are owned by
`src/logs/audit/`. Production audit capture and content safety remain
[S2-03a](../design/organization-admin-plan.md#s2-03a--customer-capture-and-operator-content-isolation);
never reuse this adapter or stream for audit delivery.

## Contract

`SystemLogger` takes a required synchronous `SystemLogSink` and an optional
`LogLevel` that defaults to INFO. It prepares a `SystemLogRecord` with `level`,
local timestamp text `time`, and `message` with the caller file and line before
it calls `writeSystemLog(record)`. Source enrichment belongs only to the system
logger; audit events add no automatic source or stack metadata. The distinct
`writeSystemLog` and `writeAuditEvent` roles keep their types separate.

`OtelSystemLogSink` takes an OpenTelemetry logger that supports `emit`:

```ts
const sink = new OtelSystemLogSink(provider.getLogger('thermus'));
const logger = new SystemLogger(sink, LogLevel.INFO);
logger.info('The server started.');
```

`SystemLogger` keeps `debug`, `info`, `warning`, `error`, `fatal`, and `setLevel`. `error`
and `fatal` accept a message or a failure. `SystemLogger` renders an `Error` as
its message, a `SuppressedError` as both messages, and another value as its
text; `SystemLogger.messageOf()` gives the same text to a caller that composes a
longer line. Each accepted call emits one plain log body with the caller file,
line, and original message. The sink ignores the formatted local time; the SDK
assigns its event timestamp. `writeSystemLog` completes synchronously and lets
write failures escape to the caller. Return from this call does not mean that
network delivery is complete. Composition owns the SDK provider, exporter,
flush, and shutdown. The adapter does not read Axiom settings or install a
global provider. `ConsoleSystemLogSink` writes to stderr and accepts a custom
`Writable`. In production, each record goes to it. Since SO-11a, the hosted
control plane with the three settings of the
[system log export](#system-log-export-of-the-control-plane) also gives each
record to `OtelSystemLogSink`.

| Method | Severity number | Severity text |
| --- | --- | --- |
| `debug` | 5 | `DEBUG` |
| `info` | 9 | `INFO` |
| `warning` | 13 | `WARNING` |
| `error` | 17 | `ERROR` |
| `fatal` | 21 | `FATAL` |

The unit tests use an in-memory `emit` double and block outbound network calls.
They do not create an SDK provider or exporter, and need no Axiom credentials.
The acceptance and interface tests use the real SDK and OTLP HTTP JSON exporter.
On every run, they export the same records to a loopback receiver and to Axiom's
[`system-log-test` dataset](https://app.axiom.co/thermus-ai-spao/datasets/system-log-test).
The loopback checks cover the exported body, severity, timestamp, and HTTP
contract. The Axiom checks require a successful exporter result after flush.
The SDK can assign the timestamp; the tests do not require the adapter to set it.

## Local runs

Set the Axiom settings below before running the acceptance or interface files.
Use the focused build command:

```sh
npm run build && node --test dist/test/acceptance/logging/system/otel-logger.test.js dist/test/unit/logging/system/otel-logger.test.js dist/test/interface/logging/system/otel-logger.test.js
```

The OpenTelemetry API, SDK, and HTTP exporter are pinned to 0.223.0, and
`@opentelemetry/resources` to 2.12.0, the version that the SDK uses. Since
SO-11a, all four are production dependencies: the control plane composes the
SDK for its system log export. The tests use the same packages.

## Axiom settings and runs

The acceptance and interface `otel-logger.test.ts` files require Axiom on every
run. Export these settings in the shell or put them in the repository's
`.env.local`:

```ini
AXIOM_API_KEY=<ingest token>
AXOIM_ENDPOINT_URL=https://us-east-1.aws.edge.axiom.co
AXIOM_SYSTEM_LOG_TEST_DATA_SET=system-log-test
```

`AXOIM_ENDPOINT_URL` retains the spelling supplied for the local environment.
Use the HTTPS ingestion endpoint, not the dataset page URL. The token needs
ingest access to `system-log-test` in the `thermus-ai-spao` organization.
The tests read `.env.local` without shell evaluation. Exported environment
values take precedence. Keep the file and its credentials out of version
control and test reports.

The script of the [basic MCP URL fetch work slice](../../test/acceptance/work-slice/basic-mcp-url-fetch/README.md)
uses the production `OtelSystemLogSink` through `openAxiomLogging()` in
`test/support/in-process/axiom-test-export.ts`. It reads the same settings with the same
reader and exports to the same test dataset. The log lines go to Axiom only.
The console gets only the export failure lines: one line for each refused or
failed export. After such a failure, the script writes one `FATAL` line and
exits with status 1 when it stops.

The test dataset setting defaults to `system-log-test`. The tests reject another
value and never use the production `AXIOM_SYSTEM_LOG_DATA_SET` setting. Missing
credentials, an invalid endpoint, and a rejected or timed-out export fail the
test; they do not skip it or fall back to local delivery.

`npm run test:acceptance`, `npm run test:interface`, and `npm test` select the
regular logger tests, so those suites also need Axiom settings and network
access. `npm run check` runs the offline unit coverage; it does not select these
logger acceptance and interface files.

`test/interface/logging/system/otel-logger-axiom.live.ts` provides an additional test
with a unique INFO message. It is separate from normal test globs and uses the
same test dataset and settings:

```sh
npm run test:interface:axiom
```

The focused acceptance and interface run sends eight records: one default INFO
record, five severity records, and two text records. The additional live command
sends two more records: one through the SDK, and one marked record through the
production composition of the system log export (SO-11a). Each fixture reports a unique scope name to identify its
records. A pass shows successful export to Axiom. It does not prove that the log
is visible in an Axiom query; that check needs query access.

## System log export of the control plane

SO-11a of the [self on-boarding plan](../implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end)
composes the SDK in `app`. [`SystemLogOutput`](../../src/app/system-log-output.ts)
is the sink of the process: it writes each record to `ConsoleSystemLogSink`
and, after the start of the export, to the `OtelSystemLogSink` of
[`openSystemLogExport()`](../../src/app/system-log-export.ts). Only the hosted
control plane with `SYSTEM_LOG_OTLP_ENDPOINT` and `SYSTEM_LOG_OTLP_TOKEN`
starts the export; [`.env.example`](../../.env.example) gives the settings and
their rules. The SDK uses a `BatchLogRecordProcessor` with a queue of 2,048
records, which drops the newest record when it is full, a batch of at most 512
records every 2 s, and an `OTLPLogExporter` whose retries end within 4 s. A
failed export drops its batch, and
[`ExportFailureLine`](../../src/app/system-log-failure-line.ts) writes one
`System log export failed:` line to stderr at most once a minute, through a
logger with only the console sink. The line names the HTTP status or the error
code, never an error message or a body. At a stop, the output waits at most 5 s
for the last records. The audit sender of `src/logs/audit/` stays separate.

The tests of the export:

- `test/unit/config/system-log-export-config.test.ts`: the three settings, their
  pairs, and their rules.
- `test/unit/app/system-log-output.test.ts` and
  `test/unit/app/system-log-export.test.ts`: both sinks, a failed export sink,
  the failure line once a minute and its cause, the stop bound with mock
  timers, the resource, and the headers.
- `test/integration/logging/system/system-log-export.test.ts`: the composition
  with the real SDK against the loopback receiver: the records, the headers,
  the resource, the drop after `500`, the bounded retries after `503`, and the
  queue that drops the 5 newest of 2,565 records while an export is in flight.
- `test/acceptance/logging/system/system-log-export.test.ts`: the built
  control plane in a child process with an https receiver, outbound access
  denied except to the loopback port of the receiver: the records and standard
  error, `500`, a refused connection, no settings, the refused settings, the
  tenant refusal, the flush at the stop, and an endpoint that does not answer.
- The production composition case of the live interface command above, with
  the dataset `system-log-test` only. On 28 October 2026, a query of the
  dataset showed its marked record with the fields `body`, `severity_text`,
  `severity_number`, `scope.name` `thermus-system-log`, and `service.name`
  `thermus-control-plane`. The production dataset `system-log` never gets a
  test record.

These tests need no Axiom settings, except the live case. The ordinary suites
select them. A focused run:

```sh
npm run build && node --test dist/test/unit/config/system-log-export-config.test.js dist/test/unit/app/system-log-output.test.js dist/test/unit/app/system-log-export.test.js dist/test/integration/logging/system/system-log-export.test.js dist/test/acceptance/logging/system/system-log-export.test.js
```

Axiom documents the `/v1/logs` endpoint, bearer authorization, and
`X-Axiom-Dataset` header in its [OpenTelemetry guide](https://axiom.co/docs/send-data/opentelemetry).
The numeric severities follow the [OpenTelemetry log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber).
