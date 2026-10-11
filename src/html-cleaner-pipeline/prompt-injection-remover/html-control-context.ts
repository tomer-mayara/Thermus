import { applyLayer1, CHECKS, STRIP } from 'agent-input-sanitizer';
import { Parser } from 'htmlparser2';
import { HiddenHtmlScanner, type VisibleTextSource } from './hidden-html-scanner.ts';

export type ControlPosition = { source: number; index: number; length: number };
type Range = { start: number; end: number };

export function moveControlPositions(positions: readonly ControlPosition[], ranges: readonly Range[]): ControlPosition[] {
  let rangeIndex = 0;
  let removed = 0;
  const retained: ControlPosition[] = [];
  for (const position of positions) {
    while (rangeIndex < ranges.length && ranges[rangeIndex].end <= position.index) {
      removed += ranges[rangeIndex].end - ranges[rangeIndex].start;
      rangeIndex++;
    }
    if (rangeIndex === ranges.length || position.index + position.length <= ranges[rangeIndex].start) {
      retained.push({ ...position, index: position.index - removed });
    }
  }
  return retained;
}

function literalControls(text: string, start: { source: number; index: number }, normalize = false): ControlPosition[] {
  const positions: ControlPosition[] = [];
  const matches = text.matchAll(STRIP);
  let match = matches.next();
  let normalizedIndex = 0;
  for (let index = 0; index < text.length; index++) {
    if (!match.done && match.value.index === index) {
      if (start.source + index !== 0 || text[index] !== '\ufeff') {
        positions.push({ source: start.source + index, index: start.index + normalizedIndex, length: match.value[0].length });
      }
      match = matches.next();
    }
    if (normalize && text[index] === '\r' && text[index + 1] === '\n') index++;
    normalizedIndex++;
  }
  return positions;
}

function appendPositions(target: ControlPosition[], positions: readonly ControlPosition[]): void {
  for (const position of positions) target.push(position);
}

function decodedPositions(source: string, segment: VisibleTextSource, offset: number): ControlPosition[] {
  let decoded = '';
  const positions: ControlPosition[] = [];
  for (const range of segment.ranges) {
    const fragment = source.slice(range.start, range.end);
    const parser = new Parser({
      ontext(text) {
        const raw = fragment.slice(parser.startIndex, parser.endIndex + 1);
        if (raw === text) {
          appendPositions(positions, literalControls(raw, {
            source: range.start + parser.startIndex, index: offset + decoded.length,
          }, true));
          decoded += raw.replace(/\r\n?/g, '\n');
        } else {
          decoded += text;
        }
      },
    }, { decodeEntities: true });
    parser.end(fragment);
  }
  if (decoded !== segment.text) throw new Error('HTML text source mapping changed decoded text');
  return positions;
}

function outsideRanges(source: string, runs: readonly VisibleTextSource[][]): Range[] {
  const ranges = runs.flat(1).flatMap(({ ranges: textRanges }) => [...textRanges])
    .sort((first, second) => first.start - second.start);
  let end = source.startsWith('\ufeff') ? 1 : 0;
  const outside: Range[] = [];
  for (const range of ranges) {
    if (range.start > end) outside.push({ start: end, end: range.start });
    end = Math.max(end, range.end);
  }
  if (end < source.length) outside.push({ start: end, end: source.length });
  return outside;
}

function contextView(source: string, runs: VisibleTextSource[][], separated: boolean) {
  const parts = [source.startsWith('\ufeff') ? '\ufeff' : ''];
  let offset = parts[0].length;
  const positions: ControlPosition[] = [];
  // Keep raw syntax and hidden controls in the original payload gate and shared budget.
  for (const range of outsideRanges(source, runs)) {
    const text = source.slice(range.start, range.end);
    appendPositions(positions, literalControls(text, { source: range.start, index: offset }));
    parts.push(text);
    offset += text.length;
  }
  for (const run of runs) {
    if (separated) { parts.push('\n'); offset++; }
    for (const segment of run) {
      const leadingBom = segment.ranges[0]?.start === 0 && source.startsWith('\ufeff');
      appendPositions(positions, decodedPositions(source, segment, offset - Number(leadingBom)));
      const text = leadingBom ? segment.text.slice(1) : segment.text;
      parts.push(text);
      offset += text.length;
    }
  }
  return { text: parts.join(''), positions };
}

function retainedControls(view: ReturnType<typeof contextView>): Set<number> {
  let positions = view.positions;
  applyLayer1(view.text, (ranges) => { positions = moveControlPositions(positions, ranges); });
  return new Set(positions.map(({ source }) => source));
}

export function htmlControlDecisions(source: string) {
  const { textRuns } = HiddenHtmlScanner.scan(source, undefined, true);
  const context = contextView(source, textRuns, true);
  const contextual = retainedControls(context);
  // A second aggregate view omits synthetic separators, so they add no budget.
  const budget = retainedControls(contextView(source, textRuns, false));
  const candidates = context.positions.map(({ source: index, length }) => ({ source: index, index, length }))
    .sort((first, second) => first.index - second.index);
  if (candidates.some((value, index) => index > 0 && candidates[index - 1].index + candidates[index - 1].length > value.index)) {
    throw new Error('HTML control source ranges overlap');
  }
  const rejected = candidates.filter(({ index }) => !contextual.has(index) || !budget.has(index));
  const removedText = rejected.map(({ index, length }) => source.slice(index, index + length)).join('');
  const found = CHECKS.filter(([, pattern]) => removedText.search(pattern) !== -1).map(([category]) => category);
  return {
    permitted: candidates.filter(({ index }) => source[index] === '\u200d' && contextual.has(index) && budget.has(index)),
    rejected,
    found,
  };
}
