// The SDK uses different HTTP behavior for the modern protocol version and for its supported legacy versions.
export const mcpProtocolEras = ['2026-07-28', '2025-11-25'] as const;

export type McpProtocolEra = typeof mcpProtocolEras[number];

// The client pins the modern version, or uses the legacy negotiation of the SDK, which selects 2025-11-25.
export function eraNegotiation(era: McpProtocolEra) {
  return { mode: era === '2026-07-28' ? { pin: era } : 'legacy' as const };
}
