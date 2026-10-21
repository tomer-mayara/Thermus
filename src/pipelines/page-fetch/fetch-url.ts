export const FETCH_URL_MAX_CODE_POINTS = 8_192;

export function isValidFetchUrl(value: unknown): value is string {
  if (typeof value !== 'string' || exceedsUrlLimit(value)) return false;
  const authority = /^https?:\/\/([^/?#]+)/i.exec(value)?.[1];
  if (authority === undefined || /[@\\]/.test(authority) || /[\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    return new URL(value).hostname !== '';
  } catch {
    return false;
  }
}

function exceedsUrlLimit(text: string): boolean {
  let length = 0;
  for (const _point of text) {
    length += 1;
    if (length > FETCH_URL_MAX_CODE_POINTS) return true;
  }
  return false;
}
