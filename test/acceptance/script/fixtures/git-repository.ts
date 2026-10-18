import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';

// git reads no global or system settings, and it gets no GIT_ variable of the caller. Thus a test in a git hook,
// where GIT_DIR names the real repository, cannot change that repository.
const gitEnvironment = { PATH: process.env.PATH ?? '', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

// A git repository in its own temporary folder, with the first branch main. The folder is removed after the test.
export class GitRepository {
  private constructor(readonly root: string) {}

  // The root is the real path of the folder, as git gives it.
  static create(t: TestContext): GitRepository {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'thermus-ast-metrics-repository-')));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const repository = new GitRepository(root);
    repository.git('init', '--quiet', '--initial-branch=main');
    repository.git('config', 'user.name', 'Thermus Test');
    repository.git('config', 'user.email', 'thermus-test@example.com');
    return repository;
  }

  static onFeatureBranch(t: TestContext, mainFiles: Readonly<Record<string, string>>): GitRepository {
    const repository = GitRepository.create(t);
    repository.commit('Start main', mainFiles);
    repository.git('switch', '--quiet', '--create', 'feature');
    return repository;
  }

  write(files: Readonly<Record<string, string>>): void {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(this.root, path)), { recursive: true });
      writeFileSync(join(this.root, path), text);
    }
  }

  // Writes the files, then commits all changes of the working tree.
  commit(message: string, files: Readonly<Record<string, string>> = {}): void {
    this.write(files);
    this.git('add', '--all');
    this.git('commit', '--quiet', '--message', message);
  }

  // A symbolic link to the root, next to the root. The link is removed after the test.
  linkToRoot(t: TestContext): string {
    const link = `${this.root}-link`;
    symlinkSync(this.root, link);
    t.after(() => rmSync(link, { force: true }));
    return link;
  }

  git(...args: string[]): string {
    return execFileSync('git', args, { cwd: this.root, env: gitEnvironment, encoding: 'utf8' });
  }
}
