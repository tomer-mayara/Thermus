import type { SourceScript, V8Function } from './input.ts';
import { CommandError } from '../shared/repository.ts';

export function validateScript({ path, length, functions }: SourceScript): void {
  if (!Number.isSafeInteger(length) || length < 0) throw new CommandError(`Invalid identified script length for ${path}.`);
  for (const entry of functions) validateFunction(entry, { path, length });
}

function validateFunction({ ranges }: V8Function, script: { readonly path: string; readonly length: number }): void {
  const whole = ranges[0];
  for (const range of ranges) {
    const fields = [range.startOffset, range.endOffset, range.count];
    if (!fields.every((field) => Number.isSafeInteger(field) && field >= 0)) {
      throw new CommandError(`Invalid coverage range offset or count for ${script.path}: each must be a nonnegative safe integer.`);
    }
    if (range.startOffset >= range.endOffset || range.endOffset > script.length
      || range.startOffset < whole.startOffset || range.endOffset > whole.endOffset) {
      throw new CommandError(`Invalid coverage range for ${script.path}: ranges must be nonempty, within the identified script length ${script.length}, and within their whole function.`);
    }
  }
}

