/** recorded: the row changed. moved: the row is absent or not in the state that the change starts from. unavailable: the change can be absent. */
export type GatewayWrite = { readonly status: 'recorded' | 'moved' | 'unavailable' };

/** resuming: this call moved the row from suspended to deploying; the service ID names the service to resume. */
export type ResumeMark =
  | { readonly status: 'resuming'; readonly serviceId: string }
  | { readonly status: 'moved' | 'unavailable' };

/** The registry writes of the MCP gateway: the resume of a suspended tenant, and the time of the last use of a tenant. */
export interface TenantGatewayStore {
  /** suspended to deploying, before the one resume call (answer 3 of 27 October 2026). */
  markResuming(organizationId: string): Promise<ResumeMark>;
  /**
   * deploying to suspended on serviceId, the service of the mark, after a failed resume call, so that the next call
   * tries again. A row that another writer gave a new service is moved.
   */
  restoreSuspended(organizationId: string, serviceId: string): Promise<GatewayWrite>;
  /** last_active_at to the time of the database, for the idle sweep. The state stays as it is. */
  recordActive(organizationId: string): Promise<GatewayWrite>;
}
