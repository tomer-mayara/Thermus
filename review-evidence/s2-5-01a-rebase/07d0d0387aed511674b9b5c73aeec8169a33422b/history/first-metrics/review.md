## AST Metrics found blocking regressions

6 new critical issue(s), 33 other regression(s)

### Summary

- ⚠️  **Complexity: +214**
- ⚠️  **Ease of maintenance: -12**
- ➖ **Outgoing dependencies: -**
- ➖ **Probability of bugs: -**

### Regressions

- **main** (`.cache/rebase251/prepare-review-evidence.py:44`, high)
  New function with cyclomatic complexity 51 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/s25-r1/prepare-review-evidence.py:32`, high)
  New function with cyclomatic complexity 39 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts:104`, high)
  Maintainability too low: got 54 (min: 85)
- **main** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/prepare-review-evidence.py:32`, high)
  New function with cyclomatic complexity 39 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **src/accounts/providers/workos/workos-organizations.ts** (`src/accounts/providers/workos/workos-organizations.ts`, high)
  Maintainability index: 53 -> 48 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **test/integration/auth/workos-connection.test.ts** (`test/integration/auth/workos-connection.test.ts`, high)
  Maintainability index: 41 -> 35 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py`, medium)
  Cyclomatic complexity too high: got 60 (max: 40)
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py:44`, medium)
  LLOC too high in method main(): got 122 (max: 20)
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py`, medium)
  Too many Lines of code (180 > 150)
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py:44`, medium)
  LOC too high in method main(): got 133 (max: 30)
- **.cache/rebase251/publish-review-evidence.py** (`.cache/rebase251/publish-review-evidence.py:26`, medium)
  LLOC too high in method main(): got 51 (max: 20)
- **.cache/rebase251/publish-review-evidence.py** (`.cache/rebase251/publish-review-evidence.py:26`, medium)
  LOC too high in method main(): got 55 (max: 30)
- **main** (`.cache/rebase251/publish-review-evidence.py:26`, medium)
  New function with cyclomatic complexity 24 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/s25-01b/prepare-review-evidence.py** (`.cache/s25-01b/prepare-review-evidence.py`, medium)
  Too many Lines of code (329 > 150)
- **.cache/s25-01c/architecture/pin-final.py** (`.cache/s25-01c/architecture/pin-final.py:41`, medium)
  LLOC too high in method main(): got 47 (max: 20)
- **.cache/s25-01c/architecture/pin-final.py** (`.cache/s25-01c/architecture/pin-final.py:41`, medium)
  LOC too high in method main(): got 73 (max: 30)
- **main** (`.cache/s25-01c/architecture/pin-final.py:41`, medium)
  New function with cyclomatic complexity 19 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/s25-r1/architecture/finalize-provenance.py** (`.cache/s25-r1/architecture/finalize-provenance.py`, medium)
  Cyclomatic complexity too high: got 43 (max: 40)
- **.cache/s25-r1/prepare-review-evidence.py** (`.cache/s25-r1/prepare-review-evidence.py`, medium)
  Cyclomatic complexity too high: got 48 (max: 40)
- **.cache/s25-r1/prepare-review-evidence.py** (`.cache/s25-r1/prepare-review-evidence.py:32`, medium)
  LLOC too high in method main(): got 105 (max: 20)
- **.cache/s25-r1/prepare-review-evidence.py** (`.cache/s25-r1/prepare-review-evidence.py:32`, medium)
  LOC too high in method main(): got 114 (max: 30)
- **.cache/s25-r1/publish-review-evidence.py** (`.cache/s25-r1/publish-review-evidence.py:22`, medium)
  LLOC too high in method main(): got 50 (max: 20)
- **.cache/s25-r1/publish-review-evidence.py** (`.cache/s25-r1/publish-review-evidence.py:22`, medium)
  LOC too high in method main(): got 55 (max: 30)
- **main** (`.cache/s25-r1/publish-review-evidence.py:22`, medium)
  New function with cyclomatic complexity 21 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/organizations/membership-removal-checks.ts** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/organizations/membership-removal-checks.ts`, medium)
  Cyclomatic complexity too high: got 43 (max: 40)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts`, medium)
  Cyclomatic complexity too high: got 131 (max: 40)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts`, medium)
  Too many Lines of code (455 > 150)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/prepare-review-evidence.py** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/prepare-review-evidence.py`, medium)
  Cyclomatic complexity too high: got 48 (max: 40)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/prepare-review-evidence.py** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/prepare-review-evidence.py:32`, medium)
  LLOC too high in method main(): got 105 (max: 20)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/prepare-review-evidence.py** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/prepare-review-evidence.py:32`, medium)
  LOC too high in method main(): got 114 (max: 30)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/publish-review-evidence.py** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/publish-review-evidence.py:22`, medium)
  LLOC too high in method main(): got 50 (max: 20)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/publish-review-evidence.py** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/publish-review-evidence.py:22`, medium)
  LOC too high in method main(): got 55 (max: 30)
- **main** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/tooling/publish-review-evidence.py:22`, medium)
  New function with cyclomatic complexity 21 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/s25-r1/review/prepare-habit-dispositions.py** (`.cache/s25-r1/review/prepare-habit-dispositions.py`, medium)
  Cyclomatic complexity too high: got 58 (max: 40)
- **.cache/s25-01b/publish/review-evidence/s2-5-01b/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/candidate/api-surface/organization-administration.d.ts** (`.cache/s25-01b/publish/review-evidence/s2-5-01b/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/candidate/api-surface/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **.cache/s25-01c/publish/review-evidence/s2-5-01c/2271545702a8f1ec28c6f7dd913fec7024ecadeb/candidate/api-surface/src/accounts/organizations/organization-administration.d.ts** (`.cache/s25-01c/publish/review-evidence/s2-5-01c/2271545702a8f1ec28c6f7dd913fec7024ecadeb/candidate/api-surface/src/accounts/organizations/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **.cache/s25-02/publish/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f/candidate/api-surface/src/accounts/organizations/organization-administration.d.ts** (`.cache/s25-02/publish/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f/candidate/api-surface/src/accounts/organizations/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/docs/api-surface/src/accounts/organizations/organization-administration.d.ts** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/docs/api-surface/src/accounts/organizations/organization-administration.d.ts`, low)
  Efferent coupling too high: got 11 (max: 10)
- **.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts** (`.cache/s25-r1/publish/review-evidence/s2-5-r1/076e661d830b969bf233522e1163c22cd1934361/candidate/src/accounts/providers/workos/workos-organizations.ts`, low)
  Efferent coupling too high: got 25 (max: 10)
