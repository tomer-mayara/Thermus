## AST Metrics found blocking regressions

3 new critical issue(s), 5 other regression(s), 1 improvement(s)

### Summary

- ➖ **Complexity: -**
- ✅ **Ease of maintenance: +4**
- ➖ **Outgoing dependencies: -**
- ⚠️  **Probability of bugs: +0.30**

### Regressions

- **src/accounts/organizations/membership-removal-lifetime.ts** (`src/accounts/organizations/membership-removal-lifetime.ts:6`, high)
  Maintainability too low: got 70 (min: 85)
- **src/accounts/organizations/membership-removal.ts** (`src/accounts/organizations/membership-removal.ts:7`, high)
  Maintainability too low: got 43 (min: 85)
- **src/logs/audit/pg-destination-settings-store.ts** (`src/logs/audit/pg-destination-settings-store.ts`, high)
  Maintainability index: 54 -> 46 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **src/accounts/organizations/membership-removal-checks.ts** (`src/accounts/organizations/membership-removal-checks.ts`, medium)
  Cyclomatic complexity too high: got 42 (max: 40)
- **src/app/application.ts** (`src/app/application.ts:154`, medium)
  LOC too high in method composeHostedApplication(): got 31 (max: 30)
- **docs/api-surface/src/accounts/organizations/organization-administration.d.ts** (`docs/api-surface/src/accounts/organizations/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **src/logs/audit/pg-destination-settings-store.ts** (`src/logs/audit/pg-destination-settings-store.ts`, low)
  Efferent coupling too high: got 13 (max: 10)
- **test/acceptance/logging/audit/hosted-storage-failure.runtime.ts** (`test/acceptance/logging/audit/hosted-storage-failure.runtime.ts`, low)
  Estimated bugs (Halstead): 1.19 -> 1.50
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file

### Improvements

- **test/integration/auth/hosted-storage-lifecycle.test.ts** (`test/integration/auth/hosted-storage-lifecycle.test.ts`): Maintainability index: 49 -> 60
