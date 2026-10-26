# Port-selection correction

The original port review missed an indirect fixed listener. The ordinary
`hosted-live-site.test.ts` imports the shared local HTTPS site, whose TLS front
binds `localOrigin` port 46443. Its backend and WorkOS fake use ephemeral ports,
but that does not make the complete test independent of the live gate port.

The first combined capture failed four integration tests with EADDRINUSE while
the primary live gate owned the front port. No combined report was published;
acceptance did not run. Keep the failure and the completed unit raw capture.
Retry only after the manager confirms the live ports are free. Keep every case
and the production TLS behavior. Do not interrupt the primary live gate.

The manager authorized capture subject to a complete helper-binding check and
relied on the worker’s incomplete report. The worker missed the fixed front
listener. No manager instruction authorized skipping these cases or changing
ports. The primary live gate later passed 28/28; retry still waits for confirmed
port availability from the remaining-gate owner.
