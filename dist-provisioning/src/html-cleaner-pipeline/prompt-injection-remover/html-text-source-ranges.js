import { adapter as baseAdapter } from 'parse5-htmlparser2-tree-adapter';
export class HtmlTextSourceRanges {
    ranges = new WeakMap();
    adapter = {
        ...baseAdapter,
        insertText: (parent, text) => {
            baseAdapter.insertText(parent, text);
            this.clearTextLocation(parent.children.at(-1));
        },
        insertTextBefore: (parent, text, reference) => {
            baseAdapter.insertTextBefore(parent, text, reference);
            this.clearTextLocation(parent.children[parent.children.indexOf(reference) - 1]);
        },
        setNodeSourceCodeLocation: (node, location) => {
            baseAdapter.setNodeSourceCodeLocation(node, location);
            if (baseAdapter.isTextNode(node) && location !== null) {
                this.record(node, { start: location.startOffset, end: location.endOffset });
            }
        },
    };
    get(node) {
        const ranges = this.ranges.get(node);
        if (ranges === undefined)
            throw new Error('HTML text has no source ranges');
        return ranges;
    }
    clearTextLocation(node) {
        if (node === undefined || !baseAdapter.isTextNode(node)) {
            throw new Error('HTML text insertion has no text node');
        }
        // Clear the previous location so the parser supplies each full token range.
        baseAdapter.setNodeSourceCodeLocation(node, null);
    }
    record(node, range) {
        const ranges = this.ranges.get(node) ?? [];
        const previous = ranges.at(-1);
        if (previous?.end === range.start) {
            previous.end = range.end;
        }
        else {
            ranges.push(range);
        }
        this.ranges.set(node, ranges);
    }
}
//# sourceMappingURL=html-text-source-ranges.js.map