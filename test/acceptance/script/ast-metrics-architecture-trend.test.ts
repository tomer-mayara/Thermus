import { test } from 'node:test';
import { checkTrendScenario, type TrendScenario } from './fixtures/ast-metrics-trend-harness.ts';

const timeout = 20_000;
const scenarios: readonly TrendScenario[] = [
  {
    name: 'Given snapshot files and an empty store, when architecture runs without --record, then the store stays empty',
    expected: { code: 0, records: 0, stdout: /No snapshot of main in the trend store yet/ },
  },
  {
    name: 'Given a verified ancestor snapshot, when --record runs twice, then one immutable record is kept', run: 'twice',
    expected: { code: 0, records: 1, record: ({ snapshot }) => ({ sourceFingerprint: snapshot.provenance.sourceFingerprint, functionsOver30: undefined }) },
  },
  {
    name: 'Given a feature commit outside origin/main, when --record runs, then it explains the refusal and renders existing history',
    given: 'feature', history: 'legacy', run: 'record',
    expected: { code: 0, records: 1, stdout: /22 \(legacy unknown\)/, stderr: ({ snapshot }) => `No record: ${snapshot.commit.slice(0, 8)} is not on origin/main.\n` },
  },
  ...(['missing main', 'missing commit', 'short commit', 'missing provenance', 'wrong source', 'wrong date'] as const).map((given): TrendScenario => ({
    name: `Given ${given}, when offline --record runs, then no record is written`, given, run: 'record',
    expected: { code: 1, records: 0, stdout: '', worktrees: 1 },
  })),
  {
    name: 'Given changed caller source and a snapshot of the immutable base, when offline --record runs, then verification uses the base content',
    given: 'changed caller', run: 'record', expected: { code: 0, records: 1 },
  },
  {
    name: 'Given a snapshot that claims current caller source belongs to an older commit, when offline --record runs, then it refuses',
    given: 'caller identity', run: 'record', expected: { code: 1, records: 0, stderr: /source does not match its commit/ },
  },
  {
    name: 'Given malformed existing history, when --record runs, then the whole store is rejected before publication',
    history: 'malformed', run: 'record', expected: { code: 1, records: 1, stderr: /not a valid trend file/ },
  },
  {
    name: 'Given concurrent recording requests for the same commit, when both complete, then one complete record wins',
    run: 'concurrent', expected: { code: 0, records: 1, record: ({ snapshot }) => ({ commit: snapshot.commit }) },
  },
  {
    name: 'Given stored legacy data outside a repository, when snapshots render with no tools, then history remains readable and unchanged',
    history: 'legacy', run: 'without-tools', expected: { code: 0, records: 1, stdout: /22 \(legacy unknown\)/ },
  },
  {
    name: 'Given compatible head coverage, when recording an ancestor, then history says estimate and the head says measured',
    given: 'compatible coverage', run: 'record',
    expected: {
      code: 0, records: 1, stdout: /4 \(estimate\)[\s\S]*4 \(measured\)/,
      record: () => ({ functionsOver30: 4 }),
      crap: ({ snapshot }) => ({ kind: 'head-derived-estimate', coverageCommit: snapshot.commit, sourceFingerprint: snapshot.provenance.sourceFingerprint, unknownFunctions: 2 }),
      communities: { auth: 1 },
    },
  },
];

for (const scenario of scenarios) test(scenario.name, { timeout }, (t) => checkTrendScenario(t, scenario));
