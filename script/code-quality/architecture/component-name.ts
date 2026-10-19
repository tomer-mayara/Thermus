export function validComponentName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value && !['.', '..'].includes(value) && !/[\\/]/u.test(value);
}

export function componentNameOf(path: string): string | undefined {
  const parts = path.split('/');
  if (parts[0] !== 'src' || parts.length < 2 || !parts.every(validComponentName)) return undefined;
  return parts.length === 2 ? 'src' : parts[1];
}
