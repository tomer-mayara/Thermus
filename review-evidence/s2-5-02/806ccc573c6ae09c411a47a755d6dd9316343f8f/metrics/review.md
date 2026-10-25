## AST Metrics found blocking regressions

5 new critical issue(s), 15 other regression(s), 3 improvement(s)

### Summary

- ⚠️  **Complexity: +28**
- ⚠️  **Ease of maintenance: -13**
- ➖ **Outgoing dependencies: -**
- ⚠️  **Probability of bugs: +0.26**

### Regressions

- **src/accounts/organizations/membership-removal-lifetime.ts** (`src/accounts/organizations/membership-removal-lifetime.ts:6`, high)
  Maintainability too low: got 70 (min: 85)
- **src/accounts/organizations/membership-removal.ts** (`src/accounts/organizations/membership-removal.ts:7`, high)
  Maintainability too low: got 43 (min: 85)
- **src/accounts/providers/workos/workos-organizations.ts** (`src/accounts/providers/workos/workos-organizations.ts`, high)
  Maintainability index: 53 -> 47 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **src/logs/audit/pg-destination-settings-store.ts** (`src/logs/audit/pg-destination-settings-store.ts`, high)
  Maintainability index: 54 -> 46 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **test/integration/auth/workos-connection.test.ts** (`test/integration/auth/workos-connection.test.ts`, high)
  Maintainability index: 49 -> 39 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **.cache/s25-01b/prepare-review-evidence.py** (`.cache/s25-01b/prepare-review-evidence.py`, medium)
  Too many Lines of code (329 > 150)
- **.cache/s25-01c/architecture/pin-final.py** (`.cache/s25-01c/architecture/pin-final.py:41`, medium)
  LLOC too high in method main(): got 47 (max: 20)
- **.cache/s25-01c/architecture/pin-final.py** (`.cache/s25-01c/architecture/pin-final.py:41`, medium)
  LOC too high in method main(): got 73 (max: 30)
- **main** (`.cache/s25-01c/architecture/pin-final.py:41`, medium)
  New function with cyclomatic complexity 19 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **src/accounts/organizations/membership-removal-checks.ts** (`src/accounts/organizations/membership-removal-checks.ts`, medium)
  Cyclomatic complexity too high: got 43 (max: 40)
- **src/app/application.ts** (`src/app/application.ts:154`, medium)
  LOC too high in method composeHostedApplication(): got 31 (max: 30)
- **administrationTarget** (`src/logs/audit/audit-event-projection.ts:73`, medium)
  New function with cyclomatic complexity 11 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **eventAttributes** (`src/logs/audit/otlp-audit-encoding.ts:22`, medium)
  Cyclomatic complexity: 15 -> 16 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/s25-01b/publish/review-evidence/s2-5-01b/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/candidate/api-surface/organization-administration.d.ts** (`.cache/s25-01b/publish/review-evidence/s2-5-01b/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/candidate/api-surface/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **.cache/s25-01c/publish/review-evidence/s2-5-01c/2271545702a8f1ec28c6f7dd913fec7024ecadeb/candidate/api-surface/src/accounts/organizations/organization-administration.d.ts** (`.cache/s25-01c/publish/review-evidence/s2-5-01c/2271545702a8f1ec28c6f7dd913fec7024ecadeb/candidate/api-surface/src/accounts/organizations/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **docs/api-surface/src/accounts/organizations/organization-administration.d.ts** (`docs/api-surface/src/accounts/organizations/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **src/logs/audit/pg-destination-settings-store.ts** (`src/logs/audit/pg-destination-settings-store.ts`, low)
  Efferent coupling too high: got 13 (max: 10)
- **test/acceptance/logging/audit/hosted-storage-failure.runtime.ts** (`test/acceptance/logging/audit/hosted-storage-failure.runtime.ts`, low)
  Estimated bugs (Halstead): 1.17 -> 1.47
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file
- **test/integration/hosted-admin/account-routes-administration-pages.test.ts** (`test/integration/hosted-admin/account-routes-administration-pages.test.ts`, low)
  Estimated bugs (Halstead): 2.46 -> 2.56
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file
- **test/unit/organizations/organization-administration-members.test.ts** (`test/unit/organizations/organization-administration-members.test.ts`, low)
  Estimated bugs (Halstead): 0.98 -> 1.16
  Suggested action: This estimate grows with code volume and complexity; consider simplifying or splitting this file

### Improvements

- **projectAdministrationChange** (`src/logs/audit/audit-event-projection.ts:62`): Cyclomatic complexity: 11 -> 8
- **test/acceptance/auth/hosted-invitations.test.ts** (`test/acceptance/auth/hosted-invitations.test.ts`): Estimated bugs (Halstead): 1.12 -> 0.80
- **test/integration/auth/hosted-storage-lifecycle.test.ts** (`test/integration/auth/hosted-storage-lifecycle.test.ts`): Maintainability index: 49 -> 60
