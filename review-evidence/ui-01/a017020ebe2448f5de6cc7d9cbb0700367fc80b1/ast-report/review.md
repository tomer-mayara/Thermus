## AST Metrics found blocking regressions

1 new critical issue(s), 2 other regression(s), 1 improvement(s)

### Summary

- ➖ **Complexity: -**
- ⚠️  **Ease of maintenance: -5**
- ➖ **Outgoing dependencies: -**
- ⚠️  **Probability of bugs: +0.48**

### Regressions

- **test/acceptance/auth/hosted-member-removal-browser.runtime.ts** (`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`, high)
  Maintainability index: 33 -> 28 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **test/acceptance/auth/hosted-members.test.ts** (`test/acceptance/auth/hosted-members.test.ts`, low)
  Estimated bugs (Halstead): 1.30 -> 1.80
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file
- **test/integration/hosted-admin/account-routes-administration-pages.test.ts** (`test/integration/hosted-admin/account-routes-administration-pages.test.ts`, low)
  Estimated bugs (Halstead): 2.56 -> 2.83
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file

### Improvements

- **test/acceptance/auth/hosted-member-removal-browser.runtime.ts** (`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`): Estimated bugs (Halstead): 0.72 -> 0.43
