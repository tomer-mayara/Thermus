## AST Metrics found blocking regressions

2 new critical issue(s), 5 other regression(s)

### Summary

- ⚠️  **Complexity: +13**
- ⚠️  **Ease of maintenance: -14**
- ➖ **Outgoing dependencies: -**
- ➖ **Probability of bugs: -**

### Regressions

- **src/accounts/providers/workos/workos-auth-provider.ts** (`src/accounts/providers/workos/workos-auth-provider.ts`, high)
  Maintainability index: 68 -> 62 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **test/integration/auth/workos-connection.test.ts** (`test/integration/auth/workos-connection.test.ts`, high)
  Maintainability index: 49 -> 41 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **src/accounts/providers/workos/workos-auth-provider.ts** (`src/accounts/providers/workos/workos-auth-provider.ts`, medium)
  Cyclomatic complexity too high: got 56 (max: 40)
- **profileNameOf** (`src/accounts/providers/workos/workos-auth-provider.ts:168`, medium)
  New function with cyclomatic complexity 12 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **callTool** (`src/interfaces/mcp/fetch-tool-server.ts:35`, medium)
  Cyclomatic complexity: 15 -> 16 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **src/logs/audit/audit-event-projection.ts** (`src/logs/audit/audit-event-projection.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **src/logs/audit/destination-settings-service.ts** (`src/logs/audit/destination-settings-service.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
