#!/usr/bin/env node
// The helper of the SO-12 rehearsal (docs/implementation/self-onboarding-s2-release.md, section 3, part B). It makes
// the calls that the fleet script, the release workflow, and the probes do not make: the create of the staging control
// plane as a Git build with its variables and its secret file (R1), the host settings (R2), the switch to the image
// (R4), the variables of the gateway switch (R7) and of the rollback (R14), the OAuth resource (R3b), the WorkOS
// objects of the run (R6, R9, R13), the Connect tokens and the MCP calls, the browser steps of the portal, the reads of
// the staging database, and the cleanup of the WorkOS objects. It never prints a key, a token, a password, a cookie
// secret, or a private key. Exit code 0: the command ended. 1: a step failed. 2: a usage error or a refused setting.
//
// Run it from the repository root with the fleet key, and through the WorkOS Staging launcher for a WorkOS command:
//   REHEARSAL_STATE_DIR=<private folder, mode 700> REHEARSAL_CA_PATH=<CA PEM> REHEARSAL_RUN_ID=<YYYYMMDD-HHMM> \
//     node ~/.config/thermus/with-workos-staging.cjs node --env-file=<main checkout>/.env.local \
//     script/release/rehearsal/rehearsal.ts <command> [options]
import { parseArgs } from 'node:util';
import { RENDER_COMMANDS, type CommandInput } from './rehearsal-render-commands.ts';
import { RehearsalUsageError } from './rehearsal-settings.ts';
import { STEP_COMMANDS } from './rehearsal-step-commands.ts';
import { WORKOS_COMMANDS } from './rehearsal-workos-commands.ts';

const COMMANDS = { ...RENDER_COMMANDS, ...WORKOS_COMMANDS, ...STEP_COMMANDS };

const USAGE = `Usage: node --env-file=<main checkout>/.env.local script/release/rehearsal/rehearsal.ts <command> [options]
Render, with the fleet key: services, credential, create, show [--service <tenant>], wait --deploy <id> [--service <tenant>],
  events [--service <tenant>], logs --since <ISO time> [--match <a|b>] [--type app|build] [--service <tenant>], health,
  login-redirect, set-host, set NAME=value..., switch-on --sweep-hour <0-23>, tenant-vars --service <tenant>, to-image,
  to-git, delete-control, cancel --deploy <id>, watch [--seconds <10-1800>] [--service <tenant>], signup-page
WorkOS Staging, through the launcher: resources, add-resource, fixtures, signup-user, authorize --org A|B,
  call --org A|B [--until-answer] [--no-renew], signup --name <organization name>, view --org A|B, resume-check,
  delete-org --org A|B, cleanup-workos, orgs-since --since <ISO time>, run-objects, fleet -- <fleet.ts command and options>
Staging database: db-counts, db-tenants. State: state`;

async function main(argv: readonly string[]): Promise<number> {
  const controller = new AbortController();
  process.on('SIGINT', () => { controller.abort(new Error('Stopped by SIGINT')); });
  try {
    const { positionals, values } = parseArgs({
      args: [...argv], allowPositionals: true, strict: true,
      options: {
        service: { type: 'string' }, deploy: { type: 'string' }, since: { type: 'string' }, match: { type: 'string' }, type: { type: 'string' },
        'sweep-hour': { type: 'string' }, org: { type: 'string' }, name: { type: 'string' }, 'until-answer': { type: 'boolean' }, 'no-renew': { type: 'boolean' },
        seconds: { type: 'string' },
      },
    });
    const [name, ...rest] = positionals;
    const command = name === undefined ? undefined : COMMANDS[name];
    if (command === undefined) throw new RehearsalUsageError(USAGE);
    const input: CommandInput = { environment: process.env, values, positionals: rest, print: (line) => { process.stdout.write(`${line}\n`); }, signal: controller.signal };
    await command(input);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return error instanceof RehearsalUsageError || (error instanceof Error && error.name === 'TypeError' && error.message.includes('parseArgs')) ? 2 : 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
