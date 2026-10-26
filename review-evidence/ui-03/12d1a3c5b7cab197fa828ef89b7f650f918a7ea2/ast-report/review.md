## AST Metrics review

Thermus review policy: new-function warnings require >10 paths; high starts at 25. Approved layer rules use CR-13 resolved imports.

Regressions: 1 high, 0 medium, 1 low. Improvements: 1. Gate: failed.

### Regressions

- **high**: Maintainability index: 28 -&gt; 21 (below 85 is hard to maintain) (`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`, rule `maintainability-regression`)
  Refactor long or deeply nested functions and reduce responsibilities in this file
- **low**: Estimated bugs (Halstead): 2.83 -&gt; 3.56 (`test/integration/hosted-admin/account-routes-administration-pages.test.ts`, rule `bugs-regression`)
  This estimate grows with code volume and complexity; consider simplifying or splitting this file

### Improvements

- **low**: Estimated bugs (Halstead): 0.43 -&gt; 0.24 (`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`, rule `bugs-improvement`)
