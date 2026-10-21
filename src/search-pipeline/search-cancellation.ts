export function isSearchCancelled(signal: AbortSignal, error?: unknown): boolean {
  if (signal.aborted) return true;
  let abortedByError = false;
  try { abortedByError = error instanceof Error && error.name === 'AbortError'; }
  catch { /* Unreadable errors keep the stage's fixed failure. */ }
  return signal.aborted || abortedByError;
}

export function throwIfSearchCancelled(signal: AbortSignal, error?: unknown): void {
  if (isSearchCancelled(signal, error)) throw new DOMException('Request cancelled', 'AbortError');
}
