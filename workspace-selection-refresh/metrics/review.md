## AST Metrics review

Thermus review policy: new-function warnings require >10 paths; high starts at 25. Approved layer rules use CR-13 resolved imports.

Regressions: 1 high, 0 medium, 0 low. Improvements: 0. Gate: failed.

### Regressions

- **high**: Maintainability index: 59 -&gt; 54 (below 85 is hard to maintain) (`src/interfaces/web/account/account-routes.ts`, rule `maintainability-regression`)
  Refactor long or deeply nested functions and reduce responsibilities in this file
