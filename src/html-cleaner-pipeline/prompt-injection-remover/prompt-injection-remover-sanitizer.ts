import { CATEGORY, sanitize } from 'agent-input-sanitizer';
import {
  COMMENT_PLACEHOLDER,
  HIDDEN_PLACEHOLDER,
  UNPARSEABLE_PLACEHOLDER,
  detectExfil,
  scanHtmlFragment,
  spliceRanges,
} from 'agent-input-sanitizer/html';
import { describeRemoved, describeWarned } from 'agent-input-sanitizer/output';
import type { Ctx } from '../html-to-markdown-pipeline.ts';
import type { PromptInjectionRemover } from './prompt-injection-remover.ts';

export class PromptInjectionRemoverSanitizer implements PromptInjectionRemover {
  private static readonly maxHtmlBytes = 10 * 1024 * 1024;

  private static readonly htmlPlaceholders = [
    COMMENT_PLACEHOLDER,
    HIDDEN_PLACEHOLDER,
    UNPARSEABLE_PLACEHOLDER,
  ] as const;

  public async invoke(ctx: Ctx): Promise<Ctx> {
    if (Buffer.byteLength(ctx.html, 'utf8') > PromptInjectionRemoverSanitizer.maxHtmlBytes) {
      throw new RangeError('HTML input exceeds the 10 MiB limit');
    }

    const sanitized = await PromptInjectionRemoverSanitizer.sanitizeKnownHtml(ctx.html);
    const html = PromptInjectionRemoverSanitizer.removeHtmlPlaceholders(sanitized.cleaned);

    return {
      ...ctx,
      html,
      skipped: ctx.skipped + sanitized.found.length,
      found: [...(ctx.found ?? []), ...sanitized.found],
      warnings: [...(ctx.warnings ?? []), ...sanitized.warnings],
    };
  }

  private static async sanitizeKnownHtml(text: string): ReturnType<typeof sanitize> {
    const sanitized = await sanitize(text);
    const preSplice = sanitized.cleaned;
    const scanned = PromptInjectionRemoverSanitizer.scanHtml(preSplice);
    sanitized.cleaned = scanned.text;
    if (scanned.removed.comments > 0) sanitized.found.push(CATEGORY.HTML_COMMENTS);
    if (scanned.removed.hidden > 0) sanitized.found.push(CATEGORY.HIDDEN_HTML);
    if (scanned.text !== preSplice) {
      sanitized.warnings.push(
        `HTML sanitized: ${describeRemoved(scanned.removed)} replaced with placeholders`,
      );
    }
    const preserved = describeWarned(scanned.warned);
    if (preserved) sanitized.warnings.push(preserved);

    const threats = detectExfil(preSplice);
    if (threats) {
      sanitized.found.push(CATEGORY.EXFIL_URLS);
      const reasons = [...new Set(threats.map((threat) =>
        `${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`,
      ))];
      sanitized.warnings.push(`Exfil-shaped URLs detected: ${reasons.join('; ')}`);
    }
    return sanitized;
  }

  private static scanHtml(text: string) {
    try {
      // The library's HTML option can keep hidden HTML inside Markdown code fences.
      const { ranges, warned } = scanHtmlFragment(text);
      const removed = { comments: 0, hidden: 0 };
      for (const range of ranges) {
        removed[range.kind === 'comment' ? 'comments' : 'hidden']++;
      }
      return { text: spliceRanges(text, ranges), removed, warned };
    } catch {
      return {
        text: UNPARSEABLE_PLACEHOLDER,
        removed: { comments: 0, hidden: 1 },
        warned: { tags: {}, dataSrc: 0 },
      };
    }
  }

  private static matchesSuffix(
    output: Uint16Array,
    outputLength: number,
    placeholder: string,
  ): boolean {
    const start = outputLength - placeholder.length;
    if (start < 0) {
      return false;
    }

    for (let offset = 0; offset < placeholder.length; offset++) {
      if (output[start + offset] !== placeholder.charCodeAt(offset)) {
        return false;
      }
    }
    return true;
  }

  private static removeSuffixPlaceholder(
    output: Uint16Array,
    outputLength: number,
  ): number | undefined {
    for (const placeholder of PromptInjectionRemoverSanitizer.htmlPlaceholders) {
      if (!PromptInjectionRemoverSanitizer.matchesSuffix(output, outputLength, placeholder)) {
        continue;
      }

      return outputLength - placeholder.length;
    }
    return undefined;
  }

  private static removeHtmlPlaceholders(text: string): string {
    if (
      !PromptInjectionRemoverSanitizer.htmlPlaceholders.some((placeholder) =>
        text.includes(placeholder),
      )
    ) {
      return text;
    }

    const output = new Uint16Array(text.length);
    let outputLength = 0;
    for (let index = 0; index < text.length; index++) {
      const codeUnit = text.charCodeAt(index);
      output[outputLength] = codeUnit;
      outputLength++;
      if (codeUnit !== 0x5d) {
        continue;
      }

      let nextLength = PromptInjectionRemoverSanitizer.removeSuffixPlaceholder(
        output,
        outputLength,
      );
      while (nextLength !== undefined) {
        outputLength = nextLength;
        nextLength = PromptInjectionRemoverSanitizer.removeSuffixPlaceholder(
          output,
          outputLength,
        );
      }
    }

    const chunks: string[] = [];
    const chunkSize = 8192;
    for (let start = 0; start < outputLength; start += chunkSize) {
      const end = Math.min(start + chunkSize, outputLength);
      chunks.push(String.fromCharCode(...output.subarray(start, end)));
    }
    return chunks.join('');
  }
}
