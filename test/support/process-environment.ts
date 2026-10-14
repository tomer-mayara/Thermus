import type { TestContext } from 'node:test';

// An undefined value removes the variable until the test ends.
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
