/**
 * The value when it is exactly the origin that the URL parser writes for it, with an allowed protocol, else undefined.
 * Thus no username, password, path, query, or fragment can stay in it.
 */
export function exactOriginOf(value: string, protocols: readonly string[]): string | undefined {
  const url = URL.parse(value);
  return url !== null && protocols.includes(url.protocol) && url.origin === value ? value : undefined;
}

/** The origin of a value with or without a final slash, written with a final slash, else undefined. */
export function originWithSlashOf(value: string, protocols: readonly string[]): string | undefined {
  const origin = exactOriginOf(value.endsWith('/') ? value.slice(0, -1) : value, protocols);
  return origin === undefined ? undefined : `${origin}/`;
}
