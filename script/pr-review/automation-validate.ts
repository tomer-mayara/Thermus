#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { validationSelection, type ValidationSelection } from './automation-selection.ts';

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status ?? result.signal}.`);
}

function main(): void {
  const base = process.env.THERMUS_BASE_SHA;
  if (!base || !/^[a-f\d]{40}$/.test(base)) throw new Error('THERMUS_BASE_SHA must be a full commit SHA.');
  const diff = spawnSync('git', ['diff', '--no-renames', '--name-only', '-z', `${base}...HEAD`], { encoding: 'utf8', shell: false });
  if (diff.status !== 0) throw new Error('Cannot select checks from the complete candidate.');
  const selection = validationSelection(diff.stdout.split('\0').filter(Boolean));
  process.stdout.write(`${JSON.stringify(selection)}\n`);
  run('git', ['diff', '--check', `${base}...HEAD`]);
  run('habit-hooks', ['--branch', base]);
  runSelectedTests(selection);
  if (selection.external) process.stdout.write('Required complete suites or metrics remain with the configured trusted external runner. This workflow proves only the checks above.\n');
}

function runSelectedTests(selection: ValidationSelection): void {
  if (selection.unit) run('npm', ['run', 'test:unit']);
  if (selection.source) {
    run('npm', ['run', 'typecheck']);
    run('npm', ['run', 'build:user-portal']);
  }
  if (selection.buildTest) run('npm', ['run', 'test:build']);
  if ((selection.focusedUnit || selection.focusedAcceptance) && !selection.unit) run('npm', ['run', 'build']);
  if (selection.focusedUnit) run('node', ['--test', '--test-concurrency=1', 'dist/test/unit/script/pr-*.test.js']);
  if (selection.focusedAcceptance) run('node', ['--test', '--test-concurrency=1', 'dist/test/acceptance/script/pr-*.test.js']);
}

try { main(); } catch (error) { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; }
