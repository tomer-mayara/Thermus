import { CATEGORY, sanitize } from 'agent-input-sanitizer';
import { detectExfil, scanHtmlFragment } from 'agent-input-sanitizer/html';
import { describeRemoved, describeWarned } from 'agent-input-sanitizer/output';
import type { Ctx } from '../html-to-markdown-pipeline.ts';
import type { PromptInjectionRemover } from './prompt-injection-remover.ts';

export class PromptInjectionRemoverSanitizer implements PromptInjectionRemover {
  private static readonly maxHtmlBytes = 10 * 1024 * 1024;

  public constructor(
    private readonly scanHtml: typeof scanHtmlFragment = scanHtmlFragment,
  ) {}

  public async invoke(ctx: Ctx): Promise<Ctx> {
    if (Buffer.byteLength(ctx.html, 'utf8') > PromptInjectionRemoverSanitizer.maxHtmlBytes) {
      throw new RangeError('HTML input exceeds the 10 MiB limit');
    }

    const sanitized = await sanitize(ctx.html);
    const { html, removed, warned } = this.removeHiddenHtml(sanitized.cleaned);
    if (removed.comments > 0) sanitized.found.push(CATEGORY.HTML_COMMENTS);
    if (removed.hidden > 0) sanitized.found.push(CATEGORY.HIDDEN_HTML);
    if (removed.comments > 0 || removed.hidden > 0) {
      sanitized.warnings.push(`HTML sanitized: ${describeRemoved(removed)} removed`);
    }
    const preserved = describeWarned(warned);
    if (preserved) sanitized.warnings.push(preserved);

    const exfilWarning = PromptInjectionRemoverSanitizer.describeExfilUrls(
      sanitized.cleaned,
      html,
    );
    if (exfilWarning) {
      sanitized.found.push(CATEGORY.EXFIL_URLS);
      sanitized.warnings.push(exfilWarning);
    }

    return {
      ...ctx,
      html,
      skipped: ctx.skipped + sanitized.found.length,
      found: [...(ctx.found ?? []), ...sanitized.found],
      warnings: [...(ctx.warnings ?? []), ...sanitized.warnings],
    };
  }

  private static describeExfilUrls(input: string, html: string): string | undefined {
    const threats = [
      ...(detectExfil(input) ?? []),
      ...(html === input ? [] : (detectExfil(html) ?? [])),
    ];
    if (threats.length === 0) return undefined;

    const reasons = new Set(
      threats.map(
        (threat) =>
          `${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`,
      ),
    );
    return `Exfil-shaped URLs detected: ${[...reasons].join('; ')}`;
  }

  private removeHiddenHtml(text: string): {
    html: string;
    removed: { comments: number; hidden: number };
    warned: ReturnType<typeof scanHtmlFragment>['warned'];
  } {
    let scan: ReturnType<typeof scanHtmlFragment>;
    try {
      scan = this.scanHtml(text);
    } catch {
      return {
        html: '',
        removed: { comments: 0, hidden: 1 },
        warned: { tags: {}, dataSrc: 0 },
      };
    }

    const removed = { comments: 0, hidden: 0 };
    const parts: string[] = [];
    let cursor = 0;
    for (const range of scan.ranges.sort((left, right) => left.start - right.start)) {
      removed[range.kind === 'comment' ? 'comments' : 'hidden']++;
      if (range.start > cursor) parts.push(text.slice(cursor, range.start));
      cursor = Math.max(cursor, range.end);
    }
    parts.push(text.slice(cursor));
    return { html: parts.join(''), removed, warned: scan.warned };
  }
}
