## AST Metrics found blocking regressions

2 new critical issue(s), 2 other regression(s), 1 improvement(s)

### Summary

- ➖ **Complexity: -**
- ⚠️  **Ease of maintenance: -0**
- ➖ **Outgoing dependencies: -**
- ➖ **Probability of bugs: -**

### Regressions

- **src/logs/audit/audit-snapshot-state.ts** (`src/logs/audit/audit-snapshot-state.ts`, high)
  Maintainability index: 68 -> 62 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **test/acceptance/logging/audit/activity-snapshots.test.ts** (`test/acceptance/logging/audit/activity-snapshots.test.ts`, high)
  Maintainability index: 43 -> 38 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **src/logs/audit/audit-snapshots.ts** (`src/logs/audit/audit-snapshots.ts`, medium)
  Too many Lines of code (156 > 150)
- **src/logs/audit/audit-snapshots.ts** (`src/logs/audit/audit-snapshots.ts`, low)
  Efferent coupling too high: got 13 (max: 10)

### Improvements

- **test/support/in-process/audit-collector-site.ts** (`test/support/in-process/audit-collector-site.ts`): Maintainability index: 55 -> 66
