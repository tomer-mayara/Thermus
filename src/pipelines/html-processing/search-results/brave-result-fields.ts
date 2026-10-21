import { sanitize } from 'agent-input-sanitizer';

export class BraveResultFields {
  private readonly findings = new Set<string>();
  private readonly notices = new Set<string>();

  public constructor(private readonly finalUrl: string) {}

  public get found(): string[] { return [...this.findings]; }
  public get warnings(): string[] { return [...this.notices]; }

  public async clean(value: string): Promise<string> {
    const report = await sanitize(' ' + value);
    if (!report.cleaned.startsWith(' ')) throw new Error('Sanitizer changed the text boundary prefix');
    for (const category of report.found) this.findings.add(category);
    for (const notice of report.warnings) this.notices.add(notice);
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
