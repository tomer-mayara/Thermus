# OTel logger tests

These tests verify `OtelLogger` in `src/logging/otel-logger.ts`. The adapter sends
each accepted message to a supplied OpenTelemetry logger.

## Contract

`OtelLogger` extends `BaseLogger`. Its constructor takes an OpenTelemetry logger
that supports `emit`, followed by an optional `LogLevel` that defaults to INFO:

```ts
const logger = new OtelLogger(provider.getLogger('thermus'), LogLevel.INFO);
logger.info('The server started.');
```

It keeps `debug`, `info`, `warning`, `error`, `fatal`, and `setLevel`. Each accepted
call emits one plain log body with the caller file, line, and original message.
The caller owns the SDK provider, exporter, flush, and shutdown. The adapter does
not read Axiom settings or install a global provider.

| Method | Severity number | Severity text |
| --- | --- | --- |
| `debug` | 5 | `DEBUG` |
| `info` | 9 | `INFO` |
| `warning` | 13 | `WARNING` |
| `error` | 17 | `ERROR` |
| `fatal` | 21 | `FATAL` |

The unit tests use an emitter double. The acceptance and local interface tests
use the real SDK and OTLP HTTP JSON exporter with a loopback receiver. The
interface checks cover the exported body, severity, timestamp, and HTTP contract.
The SDK can assign the timestamp; the tests do not require the adapter to set it.

## Local runs

Use the focused build command:

```sh
npm run build && node --test dist/test/acceptance/logging/otel-logger.test.js dist/test/unit/logging/otel-logger.test.js dist/test/interface/logging/otel-logger.test.js
```

The OpenTelemetry API, SDK, and HTTP exporter are pinned to 0.223.0. The API is
a production dependency. The SDK and HTTP exporter are test dependencies; the
caller supplies them when it configures an export destination.

## Axiom run

`test/interface/logging/otel-logger-axiom.live.ts` is separate from normal test
globs. Export these settings in the shell:

```ini
AXIOM_API_KEY=<ingest token>
AXOIM_ENDPOINT_URL=https://us-east-1.aws.edge.axiom.co
AXIOM_SYSTEM_LOG_DATA_SET=system-log
```

`AXOIM_ENDPOINT_URL` retains the spelling supplied for the local environment.
The test requires all three settings and does not load an environment file.

```sh
npm run test:interface:axiom
```

If the settings are in the repository's `.env.local`, load that file with Node:

```sh
npm run build && node --env-file=.env.local --test dist/test/interface/logging/otel-logger-axiom.live.js
```

Node reads the file without shell evaluation. Keep the file and its credentials
out of version control and test reports.

This command sends one uniquely named test log. It checks the exporter result;
flush completion alone does not prove that Axiom accepted the request. A pass
shows successful export to the configured endpoint. It does not prove that the
log is visible in an Axiom query. The token needs ingest access to the dataset.

Axiom documents the `/v1/logs` endpoint, bearer authorization, and
`X-Axiom-Dataset` header in its [OpenTelemetry guide](https://axiom.co/docs/send-data/opentelemetry).
The numeric severities follow the [OpenTelemetry log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber).
