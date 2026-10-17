# Portal design

The owner approved this design for implementation on 16 October 2026.
It covers the public portal, signup, and hosted AuthKit sign-in.

## Visual system

Use the existing Thermus logo and IBM Plex fonts from the marketing design kit.
Use Ink `#17181D`, Card `#212228`, Cream `#F3F2EE`, Gray `#B4BAC0`,
Orange `#E8552A`, and control borders `#7B7E88`. Use dark text on orange
buttons, visible keyboard focus, and at least 48px action heights.

The desktop portal has a brand panel and a welcome card. Signup has a short
step list and a document card. On mobile, stack the content and omit the
diagram. The hosted sign-in form keeps its existing authentication methods.

## Approved copy

- MCP GATEWAY FOR AGENT WEB ACCESS
- Protect against prompt injection and data leaks from AI agents
- Security for organizations that are deploying organization-wide AI tools
  that give employees the ability to create agents.

Keep the functional actions: Sign in, Start free access, and Activate free
access. Free access requires no card and creates no automatic charge.

## Simple flow diagram

Show three nodes: Your agents, Thermus, and The web. Only Thermus has an
orange border. Show these four labelled arrows:

- Your agents to Thermus: white, Request + reason.
- Thermus to The web: white, Approved.
- The web to Thermus: dashed red, Raw pages.
- Thermus to Your agents: green, Clean.

Do not add internal boxes, a legend, Markdown labels, or a path around Thermus.
Give the diagram a text equivalent for assistive technology.

## Behavior

The portal must read the session before it selects a view. Keep the existing
workspace selection, product access, MCP connection, and sign-out behavior.
Use the current login and signup routes.

Signup is workspace activation after identity sign-in. Do not add account or
payment fields. Keep all approved document text, versions, hashes, and the
exact unchecked agreement. Keep the existing origin, CSRF, eligibility,
email verification, and activation checks.

Render the full legal documents as readable text. On desktop, readers must
support keyboard scrolling. On mobile, use disclosures with the original
opening text and the full document available in normal page flow. Do not
require reading or scrolling before activation. Keep the agreement outside
the disclosures. Give closed and failure states usable recovery actions.

## Verification

First specify the new visible behavior in failing acceptance tests. Run the
changed tests, the required repository gates, and desktop and mobile browser
checks. Check narrow screens, zoom, keyboard focus, document disclosures,
and the four arrow directions. Record the results in the pull request.

Hosted AuthKit branding is an environment setting. Save the previous branding
before applying a change. Match the production client ID, review the staged
HTML and CSS, and keep authentication methods and redirect settings unchanged.
