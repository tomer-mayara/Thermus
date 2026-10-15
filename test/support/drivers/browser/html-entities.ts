// The one place that writes entities on the product pages is escapeHtml() of src/html/html-escape.ts.
// It writes only these five entities, so the test browsers decode only these.
const HTML_ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

export function decodeHtml(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}
