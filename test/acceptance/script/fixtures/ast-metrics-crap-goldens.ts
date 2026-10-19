export const requiredGoalsMarkdown = [
  '## CRAP goals', '',
  'Goals: CRAP < 30; new functions also CRAP ≤ 15.', '',
  '| File | Function | Change | Paths | Coverage | CRAP | To do |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  '| src/a.ts | run | new | 20 | 50% | 70.0 | cover ≥ 71%; required new target missed |',
  '| src/b.ts | (anonymous) | unknown | 8 | unknown | ≥ 8 | no coverage data; identity unknown: cannot classify the new-function target |',
  '',
  'Known limit violations: 1. Measured target misses: 1. Unmeasured functions: 1. Required functions with unknown assessment or identity: 1.',
  'Unmeasured values are lower bounds; the known violation count is not an exact total.', '',
].join('\n');
