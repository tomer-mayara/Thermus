import { spawn } from 'node:child_process';
import type { CommandResult } from './command-process.ts';

export interface DockerResult {
  readonly code: number | null;
  readonly stdout: Buffer;
  readonly stderr: string;
}

interface DockerOptions {
  readonly input?: string | Buffer;
  readonly environment?: NodeJS.ProcessEnv;
}

export function docker(args: readonly string[], options: DockerOptions = {}): Promise<DockerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], env: options.environment ?? process.env });
    const stdout: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(stdout), stderr }));
    // A command that does not read its input closes the pipe; that is not a failure.
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.input ?? '');
  });
}

export async function dockerOutput(args: readonly string[], options: DockerOptions = {}): Promise<string> {
  const result = await docker(args, options);
  if (result.code !== 0) throw new Error(`docker ${args.slice(0, 2).join(' ')} exited with ${result.code}:\n${result.stderr}`);
  return result.stdout.toString('utf8').trimEnd();
}

export async function dockerCommand(args: readonly string[], input: readonly string[] = []): Promise<CommandResult> {
  const { code, stdout, stderr } = await docker(args, { input: input.map((line) => `${line}\n`).join('') });
  return { code, signal: null, stdout: stdout.toString('utf8'), stderr };
}
