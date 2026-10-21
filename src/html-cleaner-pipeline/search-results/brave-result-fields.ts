import { sanitize } from 'agent-input-sanitizer';

export class BraveResultFields {
  private readonly reports: Awaited<ReturnType<typeof sanitize>>[] = [];

  public constructor(private readonly finalUrl: string) {}

  public get found(): string[] { return this.reports.flatMap((report) => report.found); }
  public get warnings(): string[] { return this.reports.flatMap((report) => report.warnings); }

  public async clean(value: string): Promise<string> {
    const report = await sanitize(' ' + value);
    if (!report.cleaned.startsWith(' ')) throw new Error('Sanitizer changed the text boundary prefix');
    this.reports.push(report);
    return report.cleaned.slice(1);
  }

  public async base(href: string): Promise<string> {
    const cleaned = await this.clean(href);
    try { return new URL(cleaned || this.finalUrl, this.finalUrl).href; }
    catch { return this.finalUrl; }
  }

  public async destination(href: string, base: string): Promise<string | undefined> {
    const value = (await this.clean(href)).trim();
    if (!value) return undefined;
    try {
      const url = new URL(value, base);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
    } catch { return undefined; }
  }
}
