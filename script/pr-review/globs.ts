// The glob syntax of the rules file: minimatch on the repository path, with dot files. "**" as a whole name matches
// any number of folders, "*" matches any text in one name, and "?" matches one character. A pattern without a slash
// matches a file at the root only. Node 24 has path.matchesGlob, but its wildcards skip a name that starts with a
// dot: "docs/**" does not match "docs/.hidden/x.md". Thus the check has its own matcher.
const unsupported = /[[\]{}()\\]|^!/u;
const wildcards = new Map([['*', '.*'], ['?', '.']]);

// Braces, classes, extended globs, escapes, and negation are minimatch syntax that this matcher does not know. A
// repository path has no empty name, no "." and no "..", so it has no slash at its start or its end.
export function unsupportedGlob(pattern: string): boolean {
  return unsupported.test(pattern) || pattern.split('/').some((name) => name === '' || name === '.' || name === '..');
}

function globMatches(pattern: string, path: string): boolean {
  return namesMatch(pattern.split('/'), path.split('/'));
}

export function anyGlobMatches(patterns: readonly string[], path: string): boolean {
  return patterns.some((pattern) => globMatches(pattern, path));
}

function namesMatch(patterns: readonly string[], names: readonly string[]): boolean {
  const [first, ...rest] = patterns;
  if (first === undefined) return names.length === 0;
  if (first === '**') return names.some((_, index) => namesMatch(rest, names.slice(index))) || namesMatch(rest, []);
  return names.length > 0 && nameMatches(first, names[0]) && namesMatch(rest, names.slice(1));
}

function nameMatches(pattern: string, name: string): boolean {
  const source = [...pattern].map((character) => wildcards.get(character) ?? character.replace(/[.+^${}()|[\]\\/]/u, '\\$&')).join('');
  return new RegExp(`^${source}$`, 'u').test(name);
}
