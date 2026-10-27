## AST Metrics found blocking regressions

1 new critical issue(s), 2 other regression(s)

### Summary

- ➖ **Complexity: -**
- ⚠️  **Ease of maintenance: -17**
- ➖ **Outgoing dependencies: -**
- ⚠️  **Probability of bugs: +1.16**

### Regressions

- **test/acceptance/auth/hosted-member-removal-browser.runtime.ts** (`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`, high)
  Maintainability index: 28 -> 11 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **test/acceptance/auth/hosted-members.test.ts** (`test/acceptance/auth/hosted-members.test.ts`, low)
  Estimated bugs (Halstead): 1.80 -> 2.44
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file
- **test/integration/hosted-admin/account-routes-administration-pages.test.ts** (`test/integration/hosted-admin/account-routes-administration-pages.test.ts`, low)
  Estimated bugs (Halstead): 2.83 -> 3.35
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file
