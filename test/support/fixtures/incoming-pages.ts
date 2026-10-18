let nested = '<span hidden>private-hidden-text</span>';
for (let pass = 1; pass < 8; pass += 1) nested = `<${nested}span hidden>private-hidden-text</span>`;

export const incomingPageCases = [
  { name: 'empty', html: '', text: '', code: undefined },
  { name: 'hidden-only', html: '<div hidden>private-hidden-text</div>', text: '', code: undefined },
  { name: 'ad-only', html: '<p class="final-host-target">private-ad-text</p>', text: '', code: undefined },
  { name: 'scan-failed', html: '<p>Visible lead</p><body hidden>private-hidden-text</body>', text: '', code: 'scan_failed' },
  { name: 'scan-limit', html: `<html><body><main><h1>Story</h1><p>Visible text that is long enough to stay in the article.</p><div><script type="text/plain"></script>${nested}</script></div></main></body></html>`, text: '', code: 'scan_limit' },
  { name: 'oversize', html: 'x'.repeat(10 * 1024 * 1024 + 1), text: 'Page processing failed', code: 'step_failed' },
  { name: 'deep', html: `<html><body><main>${'<div>'.repeat(300)}private-deep-text${'</div>'.repeat(300)}</main></body></html>`, text: 'Page processing failed', code: 'step_failed' },
] as const;
