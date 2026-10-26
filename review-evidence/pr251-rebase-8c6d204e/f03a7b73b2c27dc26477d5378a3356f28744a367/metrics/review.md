## AST Metrics found blocking regressions

10 new critical issue(s), 64 other regression(s)

### Summary

- ⚠️  **Complexity: +438**
- ⚠️  **Ease of maintenance: -12**
- ➖ **Outgoing dependencies: -**
- ➖ **Probability of bugs: -**

### Regressions

- **strict_checks** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:73`, high)
  New function with cyclomatic complexity 40 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/pr251-rebase-8c6d204e/publication/publish.py:30`, high)
  New function with cyclomatic complexity 29 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/rebase251/prepare-review-evidence.py:45`, high)
  New function with cyclomatic complexity 60 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/accounts/providers/workos/workos-organizations.ts** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/accounts/providers/workos/workos-organizations.ts:103`, high)
  Maintainability too low: got 57 (min: 85)
- **main** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py:45`, high)
  New function with cyclomatic complexity 60 (threshold: 10)
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
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py`, medium)
  Cyclomatic complexity too high: got 112 (max: 40)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:42`, medium)
  LLOC too high in method blocked_draft_check(): got 28 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:73`, medium)
  LLOC too high in method strict_checks(): got 59 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:136`, medium)
  LLOC too high in method native_assets(): got 32 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:172`, medium)
  LLOC too high in method collect(): got 36 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:212`, medium)
  LLOC too high in method main(): got 39 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py`, medium)
  Too many Lines of code (255 > 150)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:73`, medium)
  LOC too high in method strict_checks(): got 60 (max: 30)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:136`, medium)
  LOC too high in method native_assets(): got 34 (max: 30)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:172`, medium)
  LOC too high in method collect(): got 38 (max: 30)
- **.cache/pr251-rebase-8c6d204e/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:212`, medium)
  LOC too high in method main(): got 40 (max: 30)
- **blocked_draft_check** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:42`, medium)
  New function with cyclomatic complexity 21 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **collect** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:172`, medium)
  New function with cyclomatic complexity 16 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:212`, medium)
  New function with cyclomatic complexity 12 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **native_assets** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:136`, medium)
  New function with cyclomatic complexity 13 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/pr251-rebase-8c6d204e/publication/publish.py** (`.cache/pr251-rebase-8c6d204e/publication/publish.py:30`, medium)
  LLOC too high in method main(): got 55 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/publish.py** (`.cache/pr251-rebase-8c6d204e/publication/publish.py:30`, medium)
  LOC too high in method main(): got 58 (max: 30)
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py`, medium)
  Cyclomatic complexity too high: got 69 (max: 40)
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py:45`, medium)
  LLOC too high in method main(): got 135 (max: 20)
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py`, medium)
  Too many Lines of code (196 > 150)
- **.cache/rebase251/prepare-review-evidence.py** (`.cache/rebase251/prepare-review-evidence.py:45`, medium)
  LOC too high in method main(): got 148 (max: 30)
- **.cache/rebase251/publish-review-evidence.py** (`.cache/rebase251/publish-review-evidence.py:26`, medium)
  LLOC too high in method main(): got 51 (max: 20)
- **.cache/rebase251/publish-review-evidence.py** (`.cache/rebase251/publish-review-evidence.py:26`, medium)
  LOC too high in method main(): got 55 (max: 30)
- **main** (`.cache/rebase251/publish-review-evidence.py:26`, medium)
  New function with cyclomatic complexity 24 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/accounts/providers/workos/workos-organizations.ts** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/accounts/providers/workos/workos-organizations.ts`, medium)
  Cyclomatic complexity too high: got 118 (max: 40)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/accounts/providers/workos/workos-organizations.ts** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/accounts/providers/workos/workos-organizations.ts`, medium)
  Too many Lines of code (430 > 150)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/app/hosted-workos-application.ts** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/app/hosted-workos-application.ts:128`, medium)
  LLOC too high in method workosProviderParts(): got 22 (max: 20)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/app/hosted-workos-application.ts** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/app/hosted-workos-application.ts`, medium)
  Too many Lines of code (176 > 150)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/app/hosted-workos-application.ts** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/candidate/src/app/hosted-workos-application.ts:128`, medium)
  LOC too high in method workosProviderParts(): got 49 (max: 30)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py`, medium)
  Cyclomatic complexity too high: got 69 (max: 40)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py:45`, medium)
  LLOC too high in method main(): got 135 (max: 20)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py`, medium)
  Too many Lines of code (196 > 150)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/prepare-review-evidence.py:45`, medium)
  LOC too high in method main(): got 148 (max: 30)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/publish-review-evidence.py** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/publish-review-evidence.py:26`, medium)
  LLOC too high in method main(): got 51 (max: 20)
- **.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/publish-review-evidence.py** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/publish-review-evidence.py:26`, medium)
  LOC too high in method main(): got 55 (max: 30)
- **main** (`.cache/rebase251/publish/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b/tooling/publish-review-evidence.py:26`, medium)
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

_... and 24 more. Download the full report for details._
