const MCP_UNAVAILABLE = Object.freeze({ error: 'temporarily_unavailable', error_description: 'Hosted authentication is not available yet.' });

// A Bearer challenge would send MCP clients to an authorization server that does not exist, so each MCP request,
// also one without a credential, gets this answer.
export class UnavailableMcpEndpoint {
  async fetch(_request: Request): Promise<Response> {
    return Response.json(MCP_UNAVAILABLE, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  async close(): Promise<void> {}
}
