## AST Metrics found regressions

0 new critical issue(s), 4 other regression(s)

### Summary

- ⚠️  **Complexity: +5**
- ⚠️  **Ease of maintenance: -12**
- ➖ **Outgoing dependencies: -**
- ⚠️  **Probability of bugs: +0.11**

### Regressions

- **src/interfaces/web/account/members-page-layout.ts** (`src/interfaces/web/account/members-page-layout.ts`, medium)
  Maintainability index: 80 -> 69 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **membersPageLayout** (`src/interfaces/web/account/members-page-layout.ts:21`, medium)
  Cyclomatic complexity: 8 -> 13 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **src/interfaces/web/account/quick-start-content.ts** (`src/interfaces/web/account/quick-start-content.ts:57`, medium)
  LOC too high in method quickStartContent(): got 32 (max: 30)
- **src/interfaces/web/account/members-page-layout.ts** (`src/interfaces/web/account/members-page-layout.ts`, low)
  Estimated bugs (Halstead): 0.16 -> 0.27
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file
