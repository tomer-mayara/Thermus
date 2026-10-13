import { compile } from 'css-select';
import { generate } from 'css-tree';
import { DomUtils } from 'htmlparser2';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { selectorSpecificity } from './css-visibility-rules.js';
import { simpleSelectorPredicate } from './css-selector-predicates.js';
const maxSelectorNodes = 128;
const maxSelectorLength = 4096;
const maxSelectorWork = 1_000_000;
export class CssSelectorLimitError extends RangeError {
    constructor(limit) {
        super(`CSS selector ${limit} limit exceeded`);
    }
}
export function documentElements(document, includeTemplateContent = false) {
    const elements = [];
    const pending = [document];
    while (pending.length > 0) {
        const node = pending.pop();
        if (node === undefined)
            break;
        if (adapter.isElementNode(node)) {
            elements.push(node);
            if (node.name === 'template') {
                if (includeTemplateContent) {
                    pending.push(adapter.getTemplateContent(node));
                }
                continue;
            }
        }
        if (!('children' in node))
            continue;
        for (let index = node.children.length - 1; index >= 0; index--) {
            pending.push(node.children[index]);
        }
    }
    return elements;
}
function boundedAdapter() {
    let remaining = maxSelectorWork;
    const spend = (cost = 1) => {
        remaining -= cost;
        if (remaining < 0)
            throw new CssSelectorLimitError('work');
    };
    return {
        ...DomUtils,
        isTag(node) {
            spend();
            return adapter.isElementNode(node);
        },
        getParent(node) {
            spend();
            return node.parent;
        },
        getAttributeValue(element, name) {
            const value = DomUtils.getAttributeValue(element, name);
            spend(1 + (value?.length ?? 0));
            return value;
        },
        getName(element) {
            spend(1 + element.name.length);
            return element.name;
        },
        prevElementSibling(node) {
            for (let previous = node.prev; previous !== null; previous = previous.prev) {
                spend();
                if (adapter.isElementNode(previous))
                    return previous;
            }
            return null;
        },
    };
}
function compileSelector(selector, options) {
    const parts = [];
    const pseudos = {};
    const context = { ...options.adapter, quirksMode: options.quirksMode };
    // css-select treats an escaped star as a wildcard and folds some non-ASCII characters.
    for (const node of selector.children) {
        if (node.type === 'Combinator') {
            parts.push(node.name);
            continue;
        }
        const name = `visibility-${parts.length}`;
        pseudos[name] = simpleSelectorPredicate(node, context);
        parts.push(`:${name}`);
    }
    return compile(parts.join(''), { ...options, pseudos });
}
export function createSelectorMatcher(document) {
    const options = {
        adapter: boundedAdapter(),
        quirksMode: document['x-mode'] === 'quirks',
    };
    return (prelude) => {
        if (prelude.type !== 'SelectorList')
            return undefined;
        const selectors = [];
        for (const selector of prelude.children) {
            if (selector.type !== 'Selector')
                return undefined;
            if (selector.children.size > maxSelectorNodes) {
                throw new CssSelectorLimitError('size');
            }
            const specificity = selectorSpecificity(selector);
            if (specificity === undefined)
                return undefined;
            const css = generate(selector);
            if (css.length > maxSelectorLength)
                throw new CssSelectorLimitError('size');
            try {
                selectors.push({ specificity, query: compileSelector(selector, options) });
            }
            catch (error) {
                if (error instanceof RangeError)
                    throw error;
                return undefined;
            }
        }
        return selectors;
    };
}
//# sourceMappingURL=css-visibility-selectors.js.map