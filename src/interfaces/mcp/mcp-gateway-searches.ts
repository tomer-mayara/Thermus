import type { ForwardedBody } from './mcp-gateway-request.ts';

// The answer of 27 October 2026: 5 searches at a time across all tenants, because all tenants of a region send their
// Brave searches from the shared outbound addresses of Render (record SO-01e).
const SEARCH_LIMIT = 5;

/**
 * The places of the searches that run through the gateway, for all tenants together. The gateway tells a search from a
 * fetch by the JSON-RPC message alone: a search is a tools/call message with the tool name search; a fetch has the tool
 * name getURLAsMarkdown. A request takes one place for each search message that it holds, and keeps its places until
 * the answer stream of the tenant ends.
 */
export class GatewaySearches {
  private active = 0;

  /** The release of the places of the body, or undefined when they do not fit. A release frees the places one time. */
  take(body: ForwardedBody): (() => void) | undefined {
    const count = body.messages.filter((message) => message.method === 'tools/call' && message.toolName === 'search').length;
    if (this.active + count > SEARCH_LIMIT) return undefined;
    this.active += count;
    let held = count;
    return () => {
      this.active -= held;
      held = 0;
    };
  }
}
