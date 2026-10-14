export function assertHtmlInputSize(html: string): void {
  if (Buffer.byteLength(html, 'utf8') > 10 * 1024 * 1024) {
    throw new RangeError('HTML input exceeds the 10 MiB limit');
  }
}
