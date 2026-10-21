#!/usr/bin/env node
import { mergeReviewedCandidate } from './automation-gate.ts';
import { GitHubMergePort, openPullRequests } from './automation-github.ts';

async function main(): Promise<void> {
  if (process.env.THERMUS_AUTO_MERGE_ENABLED !== 'true') {
    process.stdout.write('Automatic merging is disabled.\n');
    return;
  }
  const options = optionsFromEnvironment();
  const requested = process.env.THERMUS_PR_NUMBER;
  if (requested && !/^[1-9]\d*$/.test(requested)) throw new Error('The pull request number must be a positive integer.');
  const numbers = requested ? [Number(requested)] : await openPullRequests(options.repository, options.token);
  for (const number of numbers) {
    try {
      const result = await mergeReviewedCandidate(new GitHubMergePort(options, number));
      process.stdout.write(`${JSON.stringify({ pullRequest: number, ...result })}\n`);
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ pullRequest: number, eligibility: 'blocked', reason: String(error) })}\n`);
    }
  }
}

function optionsFromEnvironment() {
  const repository = requiredEnvironment('GITHUB_REPOSITORY');
  const token = requiredEnvironment('GITHUB_TOKEN');
  const root = requiredEnvironment('GITHUB_WORKSPACE');
  const runId = requiredEnvironment('GITHUB_RUN_ID');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^\d+$/.test(runId)) throw new Error('Invalid trusted GitHub execution context.');
  return { repository, token, root, runId, enabled: true,
    team: logins(process.env.THERMUS_TEAM_REVIEWERS), architects: logins(process.env.THERMUS_ARCHITECT_REVIEWERS),
    externalAppId: Number(process.env.THERMUS_REQUIRED_GATES_APP_ID),
    protectionToken: process.env.THERMUS_PROTECTION_READ_TOKEN || undefined,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function logins(value: string | undefined): string[] {
  return (value ?? '').split(',').map((login) => login.trim().toLowerCase()).filter(Boolean);
}

try { await main(); } catch (error) { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; }
