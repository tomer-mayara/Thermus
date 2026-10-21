export type Range = { start: number; end: number };

export function rangeRemapper(ranges: Range[]) {
  const removed: (Range & { total: number })[] = [];
  for (const range of [...ranges].sort((left, right) => left.start - right.start)) {
    const previous = removed.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else removed.push({ ...range, total: 0 });
  }
  let total = 0;
  for (const range of removed) {
    total += range.end - range.start;
    range.total = total;
  }
  return <T extends Range>(range: T): T | undefined => {
    let lower = 0;
    let upper = removed.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (removed[middle].end <= range.start) lower = middle + 1;
      else upper = middle;
    }
    if (removed[lower] && removed[lower].start < range.end) return undefined;
    const deleted = lower === 0 ? 0 : removed[lower - 1].total;
    return { ...range, start: range.start - deleted, end: range.end - deleted };
  };
}
