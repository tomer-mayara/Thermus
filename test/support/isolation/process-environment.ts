import type { TestContext } from 'node:test';

export function setProcessEnvironment(t: TestContext, variables: Readonly<Record<string, string | undefined>>): void {
  for (const [name, value] of Object.entries(variables)) {
    const earlier = process.env[name];
    t.after(() => {
      if (earlier === undefined) delete process.env[name];
      else process.env[name] = earlier;
    });
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
