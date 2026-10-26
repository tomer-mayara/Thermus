## AST Metrics found regressions

0 new critical issue(s), 4 other regression(s), 3 improvement(s)

### Summary

- ⚠️  **Complexity: +6**
- ➖ **Ease of maintenance: -**
- ➖ **Outgoing dependencies: -**
- ✅ **Probability of bugs: -0.04**

### Regressions

- **administrationTarget** (`src/logs/audit/audit-event-projection.ts:74`, medium)
  New function with cyclomatic complexity 11 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **eventAttributes** (`src/logs/audit/otlp-audit-encoding.ts:23`, medium)
  Cyclomatic complexity: 15 -> 16 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **test/integration/hosted-admin/account-routes-administration-pages.test.ts** (`test/integration/hosted-admin/account-routes-administration-pages.test.ts`, low)
  Estimated bugs (Halstead): 2.46 -> 2.56
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file
- **test/unit/organizations/organization-administration-members.test.ts** (`test/unit/organizations/organization-administration-members.test.ts`, low)
  Estimated bugs (Halstead): 0.98 -> 1.16
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file

### Improvements

- **targetRefusal** (`src/accounts/organizations/membership-removal-checks.ts:33`): Cyclomatic complexity: 8 -> 5
- **projectAdministrationChange** (`src/logs/audit/audit-event-projection.ts:63`): Cyclomatic complexity: 11 -> 8
- **test/acceptance/auth/hosted-invitations.test.ts** (`test/acceptance/auth/hosted-invitations.test.ts`): Estimated bugs (Halstead): 1.12 -> 0.80
