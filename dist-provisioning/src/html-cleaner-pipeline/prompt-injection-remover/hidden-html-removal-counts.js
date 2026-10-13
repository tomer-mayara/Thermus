import { adapter } from 'parse5-htmlparser2-tree-adapter';
export class HiddenHtmlRemovalCounts {
    tree;
    kinds = new Map();
    roots = new Map();
    deleted = new Set();
    constructor(tree) {
        this.tree = tree;
    }
    add(node, kind) {
        this.kinds.set(node, kind);
    }
    cover(node, root) {
        this.roots.set(node, root);
    }
    recordDeletion(node) {
        const root = this.roots.get(node);
        if (root)
            this.deleted.add(root);
    }
    counts() {
        const counts = { comments: 0, hidden: 0 };
        const sources = new Set();
        for (const root of this.deleted) {
            const source = adapter.isElementNode(root) ? this.tree.sourceElement(root) : root;
            if (sources.has(source))
                continue;
            sources.add(source);
            const kind = this.kinds.get(root);
            if (kind)
                counts[kind]++;
        }
        return counts;
    }
}
//# sourceMappingURL=hidden-html-removal-counts.js.map