// The grace of a platform call in flight after the stop of a tenant loop. A Render create answered in 1.9 to 2.9 s
// (SO-01c). The hosted process exits 10 s after SIGTERM (src/index.ts), and after the loops the SQL runtime closes
// (at most 1.5 s) and the system log export sends its last records (at most 5 s), so 3 s remain for the call in flight.
export const IN_FLIGHT_GRACE_MS = 3_000;

/** The two signals of a tenant loop: stop ends its claims, waits, and new calls; inFlight goes to its platform calls. */
export interface TenantLoopSignals {
  readonly stop: AbortSignal;
  readonly inFlight: AbortSignal;
}

export interface TenantLoopLifetime {
  /** Stops the loop and waits until it ends, at most the grace for its call in flight. A second close waits for the same end. */
  close(): Promise<void>;
}

/**
 * Starts a tenant loop of the control plane, such as the provisioner or the sweeps (SO-12 rehearsal of 31 October
 * 2026). The close aborts the stop signal at once, so the old instance of a deploy claims no row and starts no Render
 * call after SIGTERM. It aborts the in-flight signal graceMs later: a call in flight that ends before then writes its
 * answer to the registry before the SQL runtime closes, and a longer call is cut.
 */
export function startTenantLoop(run: (signals: TenantLoopSignals) => Promise<void>, graceMs = IN_FLIGHT_GRACE_MS): TenantLoopLifetime {
  const stop = new AbortController();
  const inFlight = new AbortController();
  const running = run({ stop: stop.signal, inFlight: inFlight.signal });
  let closing: Promise<void> | undefined;
  const close = async (): Promise<void> => {
    const reason = new DOMException('The control plane is shutting down', 'AbortError');
    stop.abort(reason);
    const grace = setTimeout(() => inFlight.abort(reason), graceMs);
    try {
      await running;
    } finally {
      clearTimeout(grace);
    }
  };
  return { close: () => (closing ??= close()) };
}
