const htmlTags = new Set([
  'a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio',
  'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blockquote', 'body', 'br', 'button',
  'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'command', 'content',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt',
  'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
  'i', 'iframe', 'image', 'img', 'input', 'ins', 'isindex', 'kbd', 'keygen',
  'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee', 'math', 'menu', 'meta', 'meter',
  'nav', 'nobr', 'noembed', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output',
  'p', 'param', 'picture', 'plaintext', 'portal', 'pre', 'progress', 'q', 'rb', 'rp', 'rt', 'rtc', 'ruby',
  's', 'samp', 'script', 'search', 'section', 'select', 'shadow', 'slot', 'small', 'source', 'span',
  'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'svg',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt',
  'u', 'ul', 'var', 'video', 'wbr', 'xmp',
]);

export function plainTextMarkdown(input: string): string | undefined {
  if (/<!--|<!doctype\b|<!\[CDATA\[|<\?xml\b/i.test(input)) {
    return undefined;
  }

  const openingTags = new Set<string>();
  for (const match of input.matchAll(/<\/?([a-z][\w:-]*)(?=[\s/>])[^<>]*>/gi)) {
    const name = match[1].toLowerCase();
    if (htmlTags.has(name) || name.includes('-')) {
      return undefined;
    }
    if (match[0].startsWith('</')) {
      if (openingTags.has(name)) {
        return undefined;
      }
    } else {
      openingTags.add(name);
    }
  }

  return input.trim()
    .replace(/[\\`*_\[\]~]/g, '\\$&')
    .replace(/&(?=(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);)/gi, '\\&')
    .replace(/<(?=\S)[^<>]+>/g, (token) => `\\${token.slice(0, -1)}\\>`)
    .replace(/^([ \t]*)(>|#{1,6}(?=[ \t]|$)|[-+](?=[ \t]|$)|[-=]{2,}(?=[ \t]*$))/gm, '$1\\$2')
    .replace(/^([ \t]*\d+)([.)])(?=[ \t])/gm, '$1\\$2');
}
