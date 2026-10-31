// The product pages put values from a request, a provider, or the configuration into an HTML text node or into a
// double-quoted attribute value. The escape changes the five characters that can end or change that context into
// entities. The test browsers decode exactly these five entities with decodeHtml() of
// test/support/drivers/browser/html-entities.ts.
const ESCAPED: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPED[character] ?? character);
}
