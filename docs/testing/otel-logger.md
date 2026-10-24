# OTel system logger tests

These tests verify `OtelSystemLogger` in
`src/logs/system/otel-system-logger.ts`. The adapter sends
each accepted internal engineering message to a supplied OpenTelemetry logger.
Customers have no access to this stream. These tests do not verify customer
Audit logs, whose event-specific API and destination runtime are owned by
`src/logs/audit/`. Production audit capture and content safety remain
[S2-03a](../design/organization-admin-plan.md#s2-03a--customer-capture-and-operator-content-isolation);
never reuse this adapter or stream for audit delivery.

## Contract

`OtelSystemLogger` extends `SystemLogger`. Source file and line enrichment belongs
only to the system logger; audit events add no automatic source or stack metadata.
Its constructor takes an OpenTelemetry logger
that supports `emit`, followed by an optional `LogLevel` that defaults to INFO:

```ts
const logger = new OtelSystemLogger(provider.getLogger('thermus'), LogLevel.INFO);
logger.info('The server started.');
```

It keeps `debug`, `info`, `warning`, `error`, `fatal`, and `setLevel`. `error`
and `fatal` accept a message or a failure. `SystemLogger` renders an `Error` as
its message, a `SuppressedError` as both messages, and another value as its
text; `SystemLogger.messageOf()` gives the same text to a caller that composes a
longer line. Each accepted call emits one plain log body with the caller file,
line, and original message. The caller owns the SDK provider, exporter, flush,
and shutdown. The adapter does not read Axiom settings or install a global
provider.

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

The OpenTelemetry API, SDK, and HTTP exporter are pinned to 0.223.0. The API is
a production dependency. The SDK and HTTP exporter are test dependencies; the
caller supplies them when it configures an export destination.

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
uses the production `OtelSystemLogger` through `openAxiomLogging()` in
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
sends one more record. Each fixture reports a unique scope name to identify its
records. A pass shows successful export to Axiom. It does not prove that the log
is visible in an Axiom query; that check needs query access.

Axiom documents the `/v1/logs` endpoint, bearer authorization, and
`X-Axiom-Dataset` header in its [OpenTelemetry guide](https://axiom.co/docs/send-data/opentelemetry).
The numeric severities follow the [OpenTelemetry log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber).
