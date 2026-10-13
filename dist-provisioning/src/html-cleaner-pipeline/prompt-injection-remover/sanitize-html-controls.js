import { applyLayer1, CATEGORY, LONE_SURROGATE_RE, sanitize, stripAnsiFully } from 'agent-input-sanitizer';
import { describeStripped } from 'agent-input-sanitizer/invisible';
import { CssSelectorLimitError } from './css-visibility-selectors.js';
import { htmlControlDecisions, moveControlPositions } from './html-control-context.js';
import { SmallTextPolicy } from './small-text-policy.js';
const joiner = '\u200d';
const replacement = '\ufffd';
function replacePositions(text, positions, character) {
    let previous = 0;
    const parts = [];
    for (const { index, length } of positions) {
        parts.push(text.slice(previous, index), character.repeat(length));
        previous = index + length;
    }
    parts.push(text.slice(previous));
    return parts.join('');
}
async function cleanWithPositions(source, protectedPositions) {
    const input = replacePositions(source, protectedPositions, replacement);
    let positions = protectedPositions;
    const { cleaned } = applyLayer1(input, (removed) => { positions = moveControlPositions(positions, removed); });
    const report = await sanitize(input, { html: false });
    if (cleaned.replace(LONE_SURROGATE_RE, replacement) !== report.cleaned
        || positions.some(({ index }) => report.cleaned[index] !== replacement)) {
        throw new Error('Sanitizer changed the source position mapping');
    }
    return { ...report, cleaned: replacePositions(report.cleaned, positions, joiner), positions };
}
function controlReport(cleaned, found, deAnsi) {
    const categories = [...found].filter((value) => value !== CATEGORY.LONE_SURROGATES);
    const warnings = categories.length ? [describeStripped(categories, deAnsi)] : [];
    if (found.has(CATEGORY.LONE_SURROGATES))
        warnings.push('Normalized lone UTF-16 surrogates');
    return { cleaned, found: [...found], warnings };
}
async function preserveLogicalJoiners(source, smallText) {
    const deAnsi = stripAnsiFully(source);
    // Residual introducers can change the meaning of a reordered text-context view.
    if (/[\u001b\u0080-\u009f]/.test(deAnsi))
        return sanitize(source, { html: false });
    let current = source.startsWith('\ufeff') || !deAnsi.startsWith('\ufeff')
        ? deAnsi : '\u200b' + deAnsi.slice(1);
    const found = new Set();
    if (deAnsi !== source)
        found.add(CATEGORY.ANSI);
    // Reject stale permits in batches after raw cleanup changes source or visibility.
    for (let pass = 0; pass < 8; pass++) {
        const decisions = htmlControlDecisions(current, smallText);
        decisions.found.forEach((value) => found.add(value));
        const ranges = decisions.rejected.map(({ index, length }) => ({ start: index, end: index + length }));
        const positions = moveControlPositions(decisions.permitted, ranges);
        current = replacePositions(current, decisions.rejected, '');
        const report = await cleanWithPositions(current, positions);
        report.found.forEach((value) => found.add(value));
        current = report.cleaned;
        const remaining = htmlControlDecisions(current, smallText);
        if (remaining.rejected.length === 0)
            return controlReport(current, found, deAnsi);
    }
    return sanitize(source, { html: false });
}
export async function sanitizeHtmlControls(source, smallText = new SmallTextPolicy()) {
    if (!source.includes(joiner))
        return sanitize(source, { html: false });
    try {
        return await preserveLogicalJoiners(source, smallText);
    }
    catch (error) {
        if (error instanceof CssSelectorLimitError)
            throw error;
        // Use the existing raw policy if a source mapping or context check fails.
        return sanitize(source, { html: false });
    }
}
//# sourceMappingURL=sanitize-html-controls.js.map