/** The time of the provisioner: a monotonic clock in milliseconds, and a wait that the stop signal ends. */
export interface ProvisioningClock {
  now(): number;
  /** Waits ms milliseconds. It rejects when the signal stops it. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}
