export type SourceRange = {
  start: number;
  end: number;
};

type SourceLine = SourceRange & {
  firstContent: number;
  lastContent: number;
};

function sourceLines(html: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let line: SourceLine = { start: 0, end: html.length, firstContent: Infinity, lastContent: -1 };
  for (let offset = 0; offset < html.length; offset++) {
    const code = html.charCodeAt(offset);
    if (code === 10) {
      line.end = offset;
      lines.push(line);
      line = { start: offset + 1, end: html.length, firstContent: Infinity, lastContent: -1 };
    } else if (code !== 32 && code !== 9) {
      line.firstContent = Math.min(line.firstContent, offset);
      line.lastContent = offset;
    }
  }
  lines.push(line);
  return lines;
}

function lineAt(lines: SourceLine[], offset: number): SourceLine {
  let low = 0;
  let high = lines.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].start <= offset) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return lines[low];
}

function loneLineRange(
  lines: SourceLine[], sourceLength: number, range: SourceRange,
): SourceRange {
  const { start, end } = range;
  const firstLine = lineAt(lines, start);
  const lastLine = lineAt(lines, end);
  if (firstLine.firstContent >= start && lastLine.lastContent < end) {
    return { start: firstLine.start, end: Math.min(lastLine.end + 1, sourceLength) };
  }
  return { start, end };
}

export function expandLoneLineRanges(html: string, ranges: SourceRange[]): SourceRange[] {
  if (ranges.length === 0) return [];
  const lines = sourceLines(html);
  return ranges.map((range) => loneLineRange(lines, html.length, range));
}
