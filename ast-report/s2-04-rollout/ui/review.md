# Audit settings local browser review

Candidate: `a7bdf1f32bb2d67e87d85ea03a701078ec04808b` (B source).
Date: 24 October 2026. Browser: bundled Playwright Chromium 156.0.8078.4.
The logging-page source hash is
`058b8a70e911cf25a67c20d11b14ddfcf084416cbb0ab45e71f8578b80554189`.
The renderer, layout, and style hashes are pinned before and after in
`browser-facts.json`; all remained equal during this review.

The ignored fixture imports `loggingPage` directly from TypeScript source with
Node 24.20.0. It serves the real page, shared CSS, production public font/logo
assets, and response CSP on loopback. Its synthetic saved state has an example
`.invalid` endpoint, `audit-log-test`, Bearer authentication, a token-present
flag, disabled export, and no actual credential. Non-GET requests are refused.
No dist rebuild, source/test edit, commit, publication, or live action was made.

## Results

At 320, 390, and 1,200 pixels, the page has no horizontal overflow. Help text,
labels, and buttons wrap within the card. The current navigation item is Audit
logs. All visible inputs have native labels, and Save/Test use native buttons.
The help clearly shows the free-text redaction limit, best-effort loss/duplicate
limit, no audit history/replay, destination authority, no-backup limit, and
optional Test behavior. The policy link was not opened.

At 390 pixels, 14 Tab steps reach Skip, home, workspace links, Privacy, endpoint,
dataset, selected authentication radio, token, Enable, Save, and Test in DOM
order. Every keyboard stop has a visible focus outline. Shift+Tab from dataset
returns to endpoint. Arrow keys change the native radio choice, and Space
toggles the export checkbox. These controls changed only the local DOM.

Chromium applies the actual dataset pattern `[A-Za-z0-9\-]{1,128}`. Blank is valid
because the field is optional. `audit-log-test`, ASCII alphanumerics/hyphens,
and 128 characters pass. Underscore, dot, slash, space, non-ASCII letter, and 129
characters fail. Native typing stops at the maxlength of 128. No browser error,
invalid-pattern diagnostic, or external request occurred.

## Finding

The new Axiom field is an unstyled native text input: 21 pixels high with
13.33-pixel text at each width. Endpoint and token fields are 52.34 pixels high
with 17-pixel text. The current shared selector covers email, URL, and password
inputs, but omits text inputs. This is visible in `audit-390-form.png` and
`audit-1200-full.png`. Native labels, keyboard, focus, and constraints still work.
The manager must decide whether to fix this before approval or retain the
visual difference with a reason. This review made no source change.

## Evidence and limits

`audit-<width>-full.png` shows the complete page. `-help.png` and `-form.png`
keep each area readable, and `-dataset-focus.png` shows the focused field.
`browser-facts.json` records geometry, labels, keyboard stops, pattern cases,
source hashes, and console/network observations. `fixture-requests.json` records
only fixture requests after server shutdown.

This is a local rendering and native-control review in Chromium. It is not a
deployed-page, provider, authorization, CSRF, persistence, receipt, or delivery
proof. No Save/Test request or legal/organization onboarding action was made.
It does not prove screen-reader announcements or Safari/Firefox behavior.
Terms/Privacy v3 remain an unapproved candidate; this review supplies no legal
approval or rollout authority. Screenshots show synthetic state, not a live
organization's settings. Local evidence is not a GitHub artifact link.
