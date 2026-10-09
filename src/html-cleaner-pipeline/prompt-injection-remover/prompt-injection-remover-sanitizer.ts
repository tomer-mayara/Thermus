import { sanitize } from 'agent-input-sanitizer';
import type { Ctx } from '../html-to-markdown-pipeline.ts';
import type { PromptInjectionRemover } from './prompt-injection-remover.ts';
import { applyCssVisibility } from './css-visibility.ts';

export class PromptInjectionRemoverSanitizer implements PromptInjectionRemover {
  private static readonly maxHtmlBytes = 10 * 1024 * 1024;
  private static readonly placeholderEndCodeUnit = ']'.charCodeAt(0);
  private static readonly outputChunkSize = 8192;

  private static readonly htmlPlaceholders = [
    '[HTML comment removed]',
    '[hidden HTML removed]',
    '[HTML unparseable — withheld]',
  ] as const;

  public async invoke(ctx: Ctx): Promise<Ctx> {
    if (Buffer.byteLength(ctx.html, 'utf8') > PromptInjectionRemoverSanitizer.maxHtmlBytes) {
      throw new RangeError('HTML input exceeds the 10 MiB limit');
    }

    const normalized = await sanitize(ctx.html);
    const sanitized = await sanitize(applyCssVisibility(normalized.cleaned), { html: true });
    const found = [...new Set([...normalized.found, ...sanitized.found])];
    const html = PromptInjectionRemoverSanitizer.removeHtmlPlaceholders(sanitized.cleaned);

    return {
      ...ctx,
      html,
      skipped: ctx.skipped + found.length,
      found: [...(ctx.found ?? []), ...found],
      warnings: [...(ctx.warnings ?? []), ...normalized.warnings, ...sanitized.warnings],
    };
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
      if (codeUnit !== PromptInjectionRemoverSanitizer.placeholderEndCodeUnit) {
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
    const chunkSize = PromptInjectionRemoverSanitizer.outputChunkSize;
    for (let start = 0; start < outputLength; start += chunkSize) {
      const end = Math.min(start + chunkSize, outputLength);
      chunks.push(String.fromCharCode(...output.subarray(start, end)));
    }
    return chunks.join('');
  }
}
