import { spawn } from 'node:child_process';

export interface DockerResult {
  readonly code: number | null;
  readonly stdout: Buffer;
  readonly stderr: string;
}

export interface DockerOptions {
  // Goes to standard input, which then ends.
  readonly input?: string | Buffer;
  // Replaces the environment of the docker command. The default is the environment of the test process.
  readonly environment?: NodeJS.ProcessEnv;
}

// Runs one docker command to its end.
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

// Runs one docker command that must succeed and gives its standard output without the final line break.
export async function dockerOutput(args: readonly string[], options: DockerOptions = {}): Promise<string> {
  const result = await docker(args, options);
  if (result.code !== 0) throw new Error(`docker ${args.slice(0, 2).join(' ')} exited with ${result.code}:\n${result.stderr}`);
  return result.stdout.toString('utf8').trimEnd();
}
