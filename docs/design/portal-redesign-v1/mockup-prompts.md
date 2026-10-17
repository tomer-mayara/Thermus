# Thermus mockup generation notes

Generated with the built-in image generation tool on October 16, 2026. These are visual design concepts, not deployed screenshots. The approved source documents and [design plan](design-plan.md) govern exact text, colors, assets, and interaction behavior. Original generated files remain in the Codex image output directory; reviewed copies are saved beside this document.

## 01-home-desktop.png

### Initial prompt

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web page design for Thermus; design review only.
Edit/composite the supplied Thermus logo into a NEW realistic desktop UI mockup. Input image 1 is the exact brand logo reference, not a layout. Preserve its three heat-shimmer stripes and lowercase cream thermus wordmark. Scale proportionally; do not redesign it.
Create a flat, perfectly front-facing, polished browser-rendered page screenshot, 1600 by 1000 aspect. No browser chrome, device frame, perspective, labels outside the page, texture, noise, gradients, glow, photography, 3D, shadows or watermark. Every UI element must look buildable, precisely aligned, with sharp legible text.
Design system: Ink #17181D full-page background, surface #1C1D23, card #212228, fine borders #2C2D34, cream #F3F2EE main text, supporting #B4BAC0. One orange #E8552A primary action with Ink text, 6px radius; secondary outline #43454E. IBM Plex Serif medium for large editorial headings, IBM Plex Sans for body/UI, IBM Plex Mono for tiny technical labels. Logo is Manrope lowercase. No other accent colors except a fine green #7FD1AE return arrow in diagram. Sparse, technical, calm.
This is the logged-out APP PORTAL HOME, not a long marketing website. A 1200px maximum content area with generous margins, 88px header with supplied logo 170px wide on left, a small plain 'thermus.ai ↗' text link on right, thin bottom divider.
Main content around y=260: two balanced columns, left width 590, right width 420, 100px gap.
Left: tiny orange uppercase monospaced 'THERMUS PORTAL'. Then a large 68px serif headline EXACTLY 'A cleaner web\nfor your agents.' Cream, two lines, measured whitespace. Supporting paragraph in 19px sans: 'Fetch public web pages through Thermus and return cleaned Markdown to your AI assistant.'
Below at y~545 a compact very precise conceptual route diagram, dark ink-deep #141519 panel 580x150 with subtle border and 12px radius. Three small neutral-outline boxes arranged left-to-right labelled 'Your agent', 'Thermus', 'The web'; only middle box has thin orange border. Straight cream line arrows point left to right between boxes. A separate straight green return line below points from Thermus back left to Your agent and is labeled 'Cleaned Markdown' in small mono. Small gray 'MCP' label over first outbound connector. Diagram content simple, no extra invented statistics or security claims.
Right: a card at y~245, 430px wide with 32px padding, 12px radius, 1px border. Heading in 30px serif EXACTLY 'Welcome to Thermus'. Supporting sans: 'Sign in to open your workspace and connect your AI assistant.' Full-width orange primary button 'Sign in' with small right arrow. Under it a subtle full-width divider, then muted 'New to Thermus?' above an outlined full-width button 'Start free access'. Final muted helper, two lines: 'No card required.\nNo automatic charge.'
Bottom page footer at y~910 thin divider, left small 'Thermus AI Inc.', right small underlined 'Privacy notice' and 'Terms of Service' separated by 24px.
Use concise copy exactly. No user avatar or fabricated live data. This should look like an actual shippable dark SaaS entry page with sophisticated serif/sans type contrast.
```

### Reviewed revision prompt

```text
Edit target: the supplied Thermus home-page UI mockup. Preserve all text, headings, logo, layout, card geometry and general dark/cream palette.
Make these tightly bounded production-fidelity corrections:
1. Fix the small route diagram only: KEEP the three boxes 'Your agent', 'Thermus', 'The web' and the existing two rightward cream outgoing arrows. DELETE the long green bottom U-shaped line that incorrectly bypasses the Thermus box. Replace with TWO SEPARATE short straight left-pointing return arrows located directly BELOW the existing outgoing arrows in the two gaps between boxes. Right gap: dashed red #FF6B5A arrow FROM The web box's LEFT edge TO Thermus box's RIGHT edge, labeled 'Raw page' below. Left gap: solid green #7FD1AE arrow FROM Thermus box's LEFT edge TO Your agent box's RIGHT edge, labeled 'Cleaned Markdown' below. No line from The web to Your agent. Routes must pass through Thermus.
2. Both button labels 'Sign in' and 'Start free access' use semibold IBM Plex Sans, not serif. Keep serif headings.
3. Flatten colors: remove texture, mottling, noise, shading and gradients. Page solid #17181D; card solid #212228; primary button solid #E8552A with dark #17181D text. Diagram background solid #141519. Fine1px borders.
Maintain flat screenshot, exact existing proportions, and legible copy. Do not add anything else.
```

## 02-signup-entry-desktop.png

### Initial prompt

```text
Use case: ui-mockup
Asset type: high-fidelity Thermus signup-entry desktop page, design review only.
Composite supplied exact Thermus logo into a NEW realistic UI. Image 1 is exact brand logo reference only. Keep the three wavy stripes (outer orange, middle cream) and lowercase cream thermus wordmark, proportional and unchanged.
Generate a flat perfectly front-facing polished rendered desktop page screenshot in 1600x1000 aspect. No browser chrome, perspective, device, shadows, glows, gradients, noise, watermark or external annotations.
Consistent design system: #17181D page, #1C1D23 subtle section, #212228 card, #2C2D34 fine borders, #43454E outline buttons, #F3F2EE cream main text, #B4BAC0 supporting text. Orange #E8552A only logo, small eyebrow, step outline and ONE primary button with dark #17181D text. Main headline IBM Plex Serif medium 64px; UI IBM Plex Sans 16px; metadata IBM Plex Mono 12px.
Layout: 1200px centered width, generous margins, 88px header with official logo 170px wide left, plain '← Back to Thermus' right, bottom 1px divider. Main content begins y=200, two columns width 530 and 540 with 100 gap.
Left column: orange mono eyebrow 'FREE ACCESS'; cream serif heading 'Start free access.' in two airy lines. Body 19px: 'Connect your AI assistant to Thermus in two steps.' Below spaced vertical two-step list: outlined orange circle '1', title 'Sign in', description 'Use your email or Google account.' Thin vertical line to neutral circle '2', title 'Activate access', description 'Review the terms and open your workspace.' Below fine rule then two-line small text 'No card required.\nNo automatic charge.'
Right card: large 540px width, subtle background #212228, 12px corners and border, padding32. Top small gray mono 'STEP 1 OF 2', then 30px serif 'Sign in to continue'. Body 'After sign-in, you will return here to review the terms and activate access.'
Below a bordered recessed document reader about 260px tall, clearly framed. Reader header row 'Privacy notice' bold 17px and tiny 'Read before continuing' gray. Divider. Rendered document typography: serif heading 'Privacy Policy', body EXACTLY 'How Thermus handles information from our website, waitlist, public product guides, hosted portal, and hosted MCP service.' Next small heading 'The essentials' followed by 'We collect waitlist and website information as described below. Our hosted service also processes sign-in and organization information, agreement records, and service logs.' The second paragraph is preview copy only, keep text clean, no markdown syntax. A visible slender vertical scrollbar at right communicates this is the start of a full readable document, a bottom row 'Scroll to read the full notice' with down arrow. Body should be realistically clipped within this reader rather than overflowing.
After the reader: full width orange button 'Sign in to continue' with small right arrow. Under it subtle text 'Email and Google sign-in are available.' No email/password entry on this page, no consent checkbox yet. NO unchecked legal agreement until later stage.
Footer at y~925 fine divider, left 'Thermus AI Inc.', right 'Privacy notice' and 'Terms of Service'. Avoid fabricated badges/security statistics. Calm sparse editorial website, not a marketing poster. All text sharp and readable.
```

### Reviewed revision prompt

```text
Edit the supplied Thermus signup-entry UI screenshot. Preserve the entire layout, logo, headings, stepper, buttons, footer, spacing and all UI copy except the body inside the Privacy notice document reader.
Replace the reader body with exact opening source text below. It is a SCROLLABLE full-document reader, so its content can be naturally CLIPPED at the bottom; do not shrink text or summarize the legal text to make it all visible.
Reader title remains 'Privacy Policy'.
First paragraph exactly: 'How Thermus handles information from our website, waitlist, public product guides, hosted portal, and hosted MCP service.'
Next paragraph starts bold 'The essentials:' followed exactly by:
'We collect waitlist and website information as described below. Our hosted service also processes sign-in and organization information, agreement records, the URLs and reasons submitted through your MCP client, fetched pages, and service logs. We fetch a requested page, clean it, and return Markdown to your chosen client.'
The bottom line naturally clips behind the reader footer 'Scroll to read the full notice'. Keep scrollbar indicating more content, not a complete summary. Use legible IBM Plex Sans for body text and bold sans for the reader's small section labels. Other large headings retain serif.
Make the page and card perfectly flat #17181D and #212228; primary orange solid #E8552A. Remove gradients and mottled texture throughout, keeping dimensions unchanged.
```

## 03-signin-desktop.png

### Initial prompt

```text
Use case: ui-mockup
Asset type: high-fidelity desktop Thermus hosted AuthKit sign-in, a design proposal.
Composite supplied exact Thermus logo into a new realistic UI screenshot. Logo reference image 1 is brand source, not layout; preserve three wavy heat stripes orange/cream/orange and lowercase cream thermus wordmark proportionally.
Flat, perfectly frontal, polished browser-rendered desktop screenshot at 1600x1000 aspect. No browser chrome, device frame, perspective, mockup annotation, gradients, glows, shadows, noise, 3D or watermark.
Use exactly the Thermus dark design language: page #17181D, left secondary panel #141519, card #212228, fine #2C2D34 borders, cream #F3F2EE headings and #B4BAC0 body. Orange #E8552A for logo, tiny eyebrow and one primary action with dark #17181D text. Serif IBM Plex Serif for headlines, IBM Plex Sans body, Mono tiny technical labels. Primary button 6px corner. One semantic green #7FD1AE return arrow is allowed.
Design a 50/50 full-height split: left static content panel with 90px padding, right quiet form area. Left logo 170px wide near x100,y55, a subtle division line at vertical x800. Left content at y285: orange mono small 'THERMUS'; large 64px cream serif headline 'A cleaner web\nfor your agents.'; 19px support 'Fetch public web pages through Thermus and return cleaned Markdown to your AI assistant.'
Below left at y580 simple tasteful diagram in an unobtrusive outlined panel: three compact boxes 'Your agent' → 'Thermus' → 'The web' from left to right; middle box thin orange border, outbound arrows cream. A green straight returning arrow from Thermus toward Your agent below, labeled 'Cleaned Markdown'. Small 'MCP' above first outbound line. No complex icon art.
Right, at x940,y225, centered compact authentication module width420. Put exact supplied logo as smaller 150px lockup centered above the form around y210 if room, so the form can retain its logo on mobile when left panel hides. Heading centered 'Sign in to Thermus' in 36px serif, above dark 420px wide card with 32px padding, 12px corners and subtle border.
Form preserves observed hosted flow EXACTLY: visible label 'Email'; input placeholder 'Your email address'; full-width orange button 'Continue with email'; horizontal thin divider split by small 'OR'; full-width outlined button with standard small multicolor Google G and text 'Continue with Google'; below a muted sentence 'Don’t have an account?' with cream underlined link 'Sign up'. Input about48px high, buttons48px high, sensible spacing24px. Do not add a password field on this first step. Do not invent social providers, SSO button, remember me or terms checkbox.
Below the card, small legal links 'Privacy notice' and 'Terms of Service', cream/gray underlined. Bottom left very small 'Thermus AI Inc.'. All text legible, neutral trustworthy production UI. Only one orange button in entire viewport.
```

### Reviewed revision prompt

```text
Edit target: supplied Thermus AuthKit sign-in page UI mockup. Preserve all text, exact logo, type, layout, card geometry, form fields/buttons and dark/cream colors.
Make only these production-fidelity corrections:
Fix the small route diagram: KEEP the three boxes 'Your agent', 'Thermus', 'The web' and their two rightward cream outgoing arrows. DELETE the long green U-shaped bottom line, which wrongly bypasses Thermus. Replace with TWO SEPARATE short left-pointing return arrows directly BELOW the existing outgoing arrows in the TWO GAPS BETWEEN THE BOXES. Right gap: dashed red #FF6B5A arrow from LEFT edge of The web box to RIGHT edge of Thermus box, with small 'Raw page' label below. Left gap: green #7FD1AE arrow from LEFT edge of Thermus box to RIGHT edge of Your agent box, with small 'Cleaned Markdown' label below. No direct Web-to-agent line. All flow passes through Thermus.
Flatten colors: NO texture/mottling/noise/shading/gradients. Right background solid #17181D; left solid #141519; card solid #212228; primary button solid #E8552A with #17181D text. Preserve subtle border outlines.
Do not add/delete any other component.
```

## 04-signup-activation-desktop.png

### Initial prompt

```text
Use case: ui-mockup
Asset type: Thermus signed-in signup activation, high-fidelity desktop full-page mockup.
Create the SECOND state of the supplied signup screenshot (image 1). Preserve its consistent two-column layout, header/footer, exact Thermus logo, cream serif editorial headings, dark tone and concise typography. Image 2 is the exact logo source. This is a new page state; DO NOT copy its current Sign in CTA.
Flat front-facing realistic browser-rendered screenshot, 1600x1200 aspect (slightly taller page to fit real agreement text), no browser chrome/perspective/device/extra label. Use perfectly solid fill colors, NO texture/noise/shadows/glow/gradients. Page #17181D, card #212228, recessed reader #1C1D23, border #2C2D34, cream #F3F2EE, supporting #B4BAC0, orange #E8552A with Ink #17181D text on one button only. Body and all buttons IBM Plex Sans; large heading IBM Plex Serif; small metadata Plex Mono.
Header official logo left at 160px width, plain '← Back to Thermus' right. Main content two columns with 100px gap.
Left: eyebrow 'FREE ACCESS', large serif headline 'One step\nto your workspace.' at ~64px. Support 'Review the terms, then activate your free access.' Vertical stepper: circle with small checkmark next to 'Signed in' with no personal email shown, neutral completed style; line down to orange outlined circle '2' next to 'Activate access', support 'Review the documents and confirm below.' Below rule, small 'No card required.\nNo automatic charge.'
Right: card approximately 650px wide with32px padding. Top mono 'STEP 2 OF 2'; serif heading 'Activate free access'; supporting line 'Free access requires no card and creates no automatic charge.'
TWO clear stacked full-document readers ABOVE the checkbox. Each is 180px tall, recessed dark fill, thin border, 8px corners, visible vertical scrollbar and 'Scroll to read' affordance. Full documents continue inside, only opening passages visible.
First reader title 'Terms of Service'; visible opening body in sans exactly: 'The terms for using the Thermus website, guides, waitlist, evaluation materials, and hosted portal and MCP service, including the limits of our security protections.' Then bold 'Security has limits.' and body 'Thermus is designed to help reduce security risks. It cannot guarantee that every prompt injection, data leak, or other threat will be detected or prevented.' Remainder naturally clipped by bottom reader boundary.
Second reader title 'Privacy notice'; visible opening text exactly: 'How Thermus handles information from our website, waitlist, public product guides, hosted portal, and hosted MCP service.' Then bold 'The essentials:' and body exactly 'We collect waitlist and website information as described below. Our hosted service also processes sign-in and organization information, agreement records, the URLs and reasons submitted through your MCP client, fetched pages, and service logs.' Remainder clipped.
Below readers place a visible UNCHECKED empty square checkbox, left aligned to a generously spaced 15-16px sans paragraph. This legal text MUST appear verbatim, complete and legible, do not summarize, replace, drop any sentence, or check the box:
'By checking this box and selecting Activate free access, I agree to the Terms of Service shown above and acknowledge that I received and read the Privacy Notice shown above. I confirm that I am at least 18 years old, am legally able to enter this agreement, and will use Thermus for business purposes. If I accept on behalf of an organization, I confirm that I have authority to bind it.'
Make 'Terms of Service' and 'Privacy Notice' underlined clickable text within paragraph. Allow the paragraph 200px vertical space if needed.
Below full-width orange primary button 'Activate free access' with right arrow. No other orange buttons. No payment fields, password, company name, fabricated user identity, or auto-checked consent.
Footer at page bottom with divider, small 'Thermus AI Inc.' and legal links. Keep page spacious and realistic, all required copy fits, no overlapping or cropped outer content.
```

## 05-mobile-review.png

### Initial prompt

```text
Use case: ui-mockup
Create a realistic MOBILE design review board adapting these three supplied desktop designs. Image1 home; image2 signup entry; image3 hosted signin. Preserve the Thermus brand and copy. 3 complete flat mobile web artboards side-by-side on a neutral dark gray canvas, wide landscape 1800x1200 aspect. Each artboard390x900 proportions, no physical phone hardware, no perspective, no browser chrome. Place small neutral monospace captions OUTSIDE above artboards: 'Home', 'Start free access', 'Sign in'. Do not mistake captions as website headings.
All pages: solid Ink #17181D, Card #212228, border #2C2D34, cream #F3F2EE text, supporting #B4BAC0. Original logo small 120px width. Orange #E8552A ONLY one primary button per screen and exact logo, primary button text Ink. All body/button text IBM Plex Sans; headline IBM Plex Serif medium; mono step metadata. No gradients/glow/noise/shadows, no extra decorative graphics. 20px page gutters,24px card padding,48px controls. Crisp, readable UI with realistic mobile sizing, not a miniaturized desktop.
ARTBOARD1 HOME:
Header logo left, tiny 'thermus.ai ↗' right, divider.
Small mono orange 'THERMUS PORTAL'.
Cream serif40px headline 'A cleaner web\nfor your agents.'
16px body 'Fetch public web pages through Thermus and return cleaned Markdown to your AI assistant.'
Below immediately a dark card with small serif26px title 'Welcome to Thermus',16px description 'Sign in to open your workspace and connect your AI assistant.'
Full-width orange 'Sign in' button; divider; 'New to Thermus?'; outline full-width 'Start free access' button. Small two-line 'No card required.\nNo automatic charge.'
Omit the desktop diagram on mobile to keep actions prominent. Footer simple 'Privacy notice' and 'Terms of Service'.
ARTBOARD2 SIGNUP ENTRY:
Header logo left; small '← Back' right.
40px serif heading 'Start free access.'
16px body 'Connect your AI assistant to Thermus in two steps.'
Compact progress row neutral text '1 Sign in — 2 Activate access' with1orange circle2neutral.
Task card: 'Sign in to continue' in26px serif;16px 'After sign-in, you will return here to review the terms and activate access.'
Compact privacy document disclosure, NO inner scroll: bold 'Privacy notice', exact opening paragraph 'How Thermus handles information from our website, waitlist, public product guides, hosted portal, and hosted MCP service.' Then underlined link 'Read full privacy notice' with small chevron. This opens full text inline in real implementation. Do not show giant policy or extra fake content.
Orange full-width 'Sign in to continue' button.
Small two-line 'No card required.\nNo automatic charge.' beneath.
Footer minimal legal links.
ARTBOARD3 HOSTED SIGNIN:
Single-column form only, NO left marketing panel/diagram. Header logo centered with generous top space.
Serif32px 'Sign in to Thermus'.
Card24pxpadding: visible label 'Email', input 'Your email address', full-width orange 'Continue with email' button. Thin divider with 'OR'. Outline 'Continue with Google' with standard small Google G. Then 'Don’t have an account?' and underlined 'Sign up'. Small 'Privacy notice' and 'Terms of Service' beneath card.
Do not add password on first screen or change login methods. Leave usable whitespace below form. Match polished professional web UI, all labels correctly spelled.
```


