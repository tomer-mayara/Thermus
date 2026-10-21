import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import { escapeHtml } from '../../html-escape.ts';
import type { SignupDocuments } from '../../../../accounts/providers/workos/workos-signup.ts';

export function signupDocumentReader(id: 'terms' | 'privacy-notice', title: string, document: SignupDocuments['terms']): string {
  const label = id === 'terms' ? 'terms of service' : 'privacy notice';
  const titleId = `${id}-title`;
  const excerpt = document.text.split(/\r?\n\s*\r?\n/).find((paragraph) => !paragraph.startsWith('#')) ?? document.text;
  return `<section class="legal-document" id="${id}" data-document-version="${escapeHtml(document.version)}">
    <header class="document-heading"><h3 id="${titleId}">${escapeHtml(title)}</h3><p class="document-version">${escapeHtml(document.version)}</p></header>
    <div class="document-desktop">
      <div class="document-reader document-text" role="region" aria-labelledby="${titleId}" tabindex="0">${renderDocument(document.text, `${id}-desktop`)}</div>
      <p class="scroll-hint">↓ Scroll to read the full ${id === 'terms' ? 'document' : 'notice'}</p>
    </div>
    <div class="document-mobile">
      <div class="document-excerpt">${renderDocument(excerpt, `${id}-excerpt`)}</div>
      <details>
        <summary><span class="read-label">Read full ${label}</span><span class="hide-label">Hide ${label}</span></summary>
        <div class="document-text">${renderDocument(document.text, `${id}-mobile`)}</div>
      </details>
    </div>
  </section>`;
}

function renderDocument(text: string, prefix: string): string {
  // Keep raw HTML and dangerous protocols disabled. Only the presentation changes; the approved source stays intact.
  return micromark(text, { extensions: [gfm()], htmlExtensions: [gfmHtml({ clobberPrefix: `${prefix}-` })] })
    .replace(/<(\/?)(h[1-3])(?=>)/g, (_tag, closing: string, heading: string) => `<${closing}h${Number(heading[1]) + 3}`);
}
