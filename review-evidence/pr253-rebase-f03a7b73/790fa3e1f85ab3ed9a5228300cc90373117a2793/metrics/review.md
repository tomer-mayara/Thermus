## AST Metrics found blocking regressions

18 new critical issue(s), 114 other regression(s), 1 improvement(s)

### Summary

- ⚠️  **Complexity: +806**
- ✅ **Ease of maintenance: +4**
- ➖ **Outgoing dependencies: -**
- ⚠️  **Probability of bugs: +0.30**

### Regressions

- **strict_checks** (`.cache/pr251-rebase-8c6d204e/publication/prepare.py:73`, high)
  New function with cyclomatic complexity 40 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/pr251-rebase-8c6d204e/publication/publish.py:30`, high)
  New function with cyclomatic complexity 29 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **strict_checks** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:73`, high)
  New function with cyclomatic complexity 40 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/publish.py:30`, high)
  New function with cyclomatic complexity 29 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **strict_checks** (`.cache/pr253-rebase-f03a7b73/publication/prepare.py:61`, high)
  New function with cyclomatic complexity 41 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/pr253-rebase-f03a7b73/publication/publish.py:31`, high)
  New function with cyclomatic complexity 34 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/pr253-rebase-f03a7b73/publication/update-text.py:22`, high)
  New function with cyclomatic complexity 25 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **comment** (`.cache/pr253-rebase-f03a7b73/quality/bind-habit.py:13`, high)
  New function with cyclomatic complexity 35 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **inspect** (`.cache/pr253-rebase-f03a7b73/validation/inspect-hosted-builds.py:28`, high)
  New function with cyclomatic complexity 44 (threshold: 10)
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
- **src/accounts/organizations/membership-removal-lifetime.ts** (`src/accounts/organizations/membership-removal-lifetime.ts:6`, high)
  Maintainability too low: got 70 (min: 85)
- **src/accounts/organizations/membership-removal.ts** (`src/accounts/organizations/membership-removal.ts:7`, high)
  Maintainability too low: got 43 (min: 85)
- **src/logs/audit/pg-destination-settings-store.ts** (`src/logs/audit/pg-destination-settings-store.ts`, high)
  Maintainability index: 54 -> 46 (below 85 is hard to maintain)
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
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py`, medium)
  Cyclomatic complexity too high: got 112 (max: 40)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:42`, medium)
  LLOC too high in method blocked_draft_check(): got 28 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:73`, medium)
  LLOC too high in method strict_checks(): got 59 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:136`, medium)
  LLOC too high in method native_assets(): got 32 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:172`, medium)
  LLOC too high in method collect(): got 36 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:212`, medium)
  LLOC too high in method main(): got 39 (max: 20)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py`, medium)
  Too many Lines of code (255 > 150)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:73`, medium)
  LOC too high in method strict_checks(): got 60 (max: 30)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:136`, medium)
  LOC too high in method native_assets(): got 34 (max: 30)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:172`, medium)
  LOC too high in method collect(): got 38 (max: 30)
- **.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:212`, medium)
  LOC too high in method main(): got 40 (max: 30)
- **blocked_draft_check** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:42`, medium)
  New function with cyclomatic complexity 21 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **collect** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:172`, medium)
  New function with cyclomatic complexity 16 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **main** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:212`, medium)
  New function with cyclomatic complexity 12 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points
- **native_assets** (`.cache/pr251-rebase-8c6d204e/publication/stage/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/tooling/publication/prepare.py:136`, medium)
  New function with cyclomatic complexity 13 (threshold: 10)
  Suggested action: Extract smaller, well-named functions to reduce decision points

_... and 82 more. Download the full report for details._

### Improvements

- **test/integration/auth/hosted-storage-lifecycle.test.ts** (`test/integration/auth/hosted-storage-lifecycle.test.ts`): Maintainability index: 49 -> 60
