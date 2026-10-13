import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { rangeRemapper } from './css-visibility-ranges.js';
function rangeKey(range) {
    return range ? `${range.start}:${range.end}:${range.identity}` : 'document';
}
function witnessKey(parent, path, child) {
    return `${rangeKey(parent)}/${path}/${rangeKey(child)}`;
}
function documentKey({ node, range, identity }) {
    if (range || !['html', 'head', 'body'].includes(node.name))
        return undefined;
    return identity;
}
function impliedContexts(node, ancestor, source) {
    const inherited = ancestor && !ancestor.range ? ancestor.implied : [];
    if (source.range)
        return inherited;
    const path = `${inherited.at(-1)?.path ?? ''}/${source.identity}`;
    return [...inherited, { node, path }];
}
function childContext(node, ancestor, source) {
    const parent = ancestor?.range ?? ancestor?.parent;
    const copyParent = ancestor?.authored && ancestor.range ? ancestor.range : ancestor?.copyParent;
    return { node, ...source, parent, copyParent, implied: impliedContexts(node, ancestor, source) };
}
function elementContexts(tree, identify) {
    const contexts = new Map();
    const identities = new Map();
    for (const node of tree.elements) {
        const ancestor = node.parent && adapter.isElementNode(node.parent)
            ? contexts.get(node.parent) : undefined;
        const source = tree.sourceElement(node);
        let identity = identities.get(source);
        if (identity === undefined) {
            identity = identify(source);
            identities.set(source, identity);
        }
        const location = adapter.getNodeSourceCodeLocation(source)?.startTag;
        const range = location ? { start: location.startOffset, end: location.endOffset, identity } : undefined;
        contexts.set(node, childContext(node, ancestor, { identity, range, authored: source === node }));
    }
    return [...contexts.values()];
}
function captureStyles(contexts, styles) {
    return contexts.map((context) => ({
        ...context,
        style: styles.get(context.node) ?? '',
        implied: context.implied.map((implied) => ({
            ...implied,
            style: styles.get(implied.node) ?? '',
        })),
    }));
}
export class CssVisibilityProvenance {
    tags = new Map();
    copies = new Map();
    witnesses = new Map();
    documents = new Map();
    identities = new Map();
    apply(tree, styles) {
        const contexts = elementContexts(tree, (node) => this.identify(node));
        for (const context of contexts) {
            const document = documentKey(context);
            const documentStyle = document === undefined ? undefined : this.documents.get(document);
            if (documentStyle !== undefined)
                styles.set(context.node, documentStyle);
            if (!context.range)
                continue;
            // The nearest authored parent distinguishes reconstructed copies of one tag.
            const retained = this.copies.get(witnessKey(context.copyParent, '', context.range))
                ?? this.tags.get(rangeKey(context.range));
            if (retained !== undefined && retained !== null)
                styles.set(context.node, retained);
            for (const implied of context.implied) {
                const style = this.witnesses.get(witnessKey(context.parent, implied.path, context.range));
                if (style !== undefined)
                    styles.set(implied.node, style);
            }
        }
        return captureStyles(contexts, styles);
    }
    retain(contexts, visible, ranges) {
        const remap = rangeRemapper(ranges);
        this.tags = new Map();
        this.copies = new Map();
        this.witnesses = new Map();
        this.documents = new Map();
        for (const context of contexts) {
            if (!visible.has(context.node))
                continue;
            const document = documentKey(context);
            if (document !== undefined)
                this.documents.set(document, context.style);
            this.retainElement(context, remap);
        }
    }
    identify(node) {
        const key = JSON.stringify([node.name, Object.entries(node.attribs).sort()]);
        let identity = this.identities.get(key);
        if (identity === undefined) {
            identity = this.identities.size;
            this.identities.set(key, identity);
        }
        return identity;
    }
    retainElement(context, remap) {
        if (!context.range)
            return;
        const range = remap(context.range);
        if (!range)
            return;
        this.retainSharedStyle(range, context.style);
        this.retainCopyStyle(context, range, remap);
        this.retainImpliedStyles(context, range, remap);
    }
    retainSharedStyle(range, style) {
        const key = rangeKey(range);
        const previous = this.tags.get(key);
        // A shared source fallback is safe only when the surviving copies agree.
        this.tags.set(key, previous === undefined || previous === style ? style : null);
    }
    retainCopyStyle(context, range, remap) {
        const copyParent = context.copyParent ? remap(context.copyParent) : undefined;
        if (context.copyParent && !copyParent)
            return;
        const key = witnessKey(copyParent, '', range);
        const previous = this.copies.get(key);
        this.copies.set(key, previous === undefined || previous === context.style ? context.style : null);
    }
    retainImpliedStyles(context, range, remap) {
        const parent = context.parent ? remap(context.parent) : undefined;
        if (context.parent && !parent)
            return;
        for (const implied of context.implied) {
            this.witnesses.set(witnessKey(parent, implied.path, range), implied.style);
        }
    }
}
//# sourceMappingURL=css-visibility-provenance.js.map