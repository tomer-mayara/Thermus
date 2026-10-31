// The views of the registry are its fenced Mermaid blocks; the prose between them is no fact. A line of a view keeps
// its text without trailing white space, so that an editor that trims lines changes no view.
const fenceStart = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/u;
const fenceEnd = /^\s*(`{3,}|~{3,})\s*$/u;

// lines collects the content of a Mermaid block. Another fenced block can hold an example of a Mermaid block, which is
// no view.
interface Fence {
  readonly marker: string;
  readonly lines?: string[];
}

// The views of HEAD against the views of the merge base. reordered: the same views stand in another order.
export interface ViewChange {
  readonly added: number;
  readonly removed: number;
  readonly edited: number;
  readonly reordered: boolean;
}

// A fence that the document does not close runs to its end.
function registryViewsOf(text: string): string[] {
  const views: string[] = [];
  let fence: Fence | undefined;
  for (const line of text.split('\n')) {
    if (fence === undefined) fence = fenceOf(line);
    else if (closes(fence, line)) {
      if (fence.lines) views.push(fence.lines.join('\n'));
      fence = undefined;
    } else fence.lines?.push(line.trimEnd());
  }
  if (fence?.lines) views.push(fence.lines.join('\n'));
  return views;
}

// Equal views pair first, wherever they stand. A view that is left over on both sides is edited; the others are
// added or removed.
export function viewChangeOf(base: string, head: string): ViewChange {
  const before = registryViewsOf(base);
  const after = registryViewsOf(head);
  const added = surplusOf(after, before);
  const removed = surplusOf(before, after);
  const edited = Math.min(added, removed);
  const same = before.length === after.length && before.every((view, index) => view === after[index]);
  return { added: added - edited, removed: removed - edited, edited, reordered: added + removed === 0 && !same };
}

function fenceOf(line: string): Fence | undefined {
  const match = fenceStart.exec(line);
  if (match === null) return undefined;
  return match[2].toLowerCase() === 'mermaid' ? { marker: match[1], lines: [] } : { marker: match[1] };
}

// A closing fence repeats the character of its opening fence, at least as many times, with nothing after it.
function closes(fence: Fence, line: string): boolean {
  const match = fenceEnd.exec(line);
  return match !== null && match[1][0] === fence.marker[0] && match[1].length >= fence.marker.length;
}

function surplusOf(views: readonly string[], others: readonly string[]): number {
  const left = [...others];
  let surplus = 0;
  for (const view of views) {
    const index = left.indexOf(view);
    if (index < 0) surplus += 1;
    else left.splice(index, 1);
  }
  return surplus;
}
