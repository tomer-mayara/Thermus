## AST Metrics found blocking regressions

1 new critical issue(s), 1 other regression(s), 2 improvement(s)

### Summary

- ✅ **Complexity: -3**
- ⚠️  **Ease of maintenance: -8**
- ➖ **Outgoing dependencies: -**
- ➖ **Probability of bugs: -**

### Regressions

- **test/unit/html/logging-test-routes.test.ts** (`test/unit/html/logging-test-routes.test.ts`, high)
  Maintainability index: 36 -> 28 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **LoggingRoutes::change** (`src/interfaces/web/account/logging-routes.ts:51`, medium)
  New function with cyclomatic complexity 12 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points

### Improvements

- **loggingPage** (`src/interfaces/web/account/logging-page.ts:32`): Cyclomatic complexity: 8 -> 5
- **logging-routes\LoggingRoutes.** (`src/interfaces/web/account/logging-routes.ts:108`): Cyclomatic complexity: 13 -> 1
