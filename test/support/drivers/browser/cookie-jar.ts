export function keepCookies(jar: Map<string, string>, setCookieLines: Iterable<string>): void {
  for (const line of setCookieLines) {
    const [pair = ''] = line.split(';');
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (name === '') continue;
    if (value === '' || /max-age=0/i.test(line)) jar.delete(name);
    else jar.set(name, value);
  }
}

export function cookieHeaderOf(jar: ReadonlyMap<string, string>): string | undefined {
  if (jar.size === 0) return undefined;
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
