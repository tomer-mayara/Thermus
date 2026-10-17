# Thermus portal — simple flow refinement

**Design proposal · October 16, 2026 · No application changes**

Use the existing Thermus identity across the public home, signup, and hosted sign-in: dark surfaces, cream serif headlines, clear Sans UI, and one orange main action per screen.

This revision uses the exact website copy from the user's selected screenshot on home, the desktop AuthKit brand panel, and mobile home. The screenshot is the copy source even where the local marketing files differ.

The latest refinement simplifies the desktop diagram using the user's marketing flow screenshot. Website copy, form UI, and legal text stay the same.

- **MCP GATEWAY FOR AGENT WEB ACCESS**
- **Protect against prompt injection and data leaks from AI agents**
- **Security for organizations that are deploying organization-wide AI tools that give employees the ability to create agents.**

The core change is a clearer journey. Home gives returning and new users a route. Signup separates identity sign-in from workspace activation. Full approved documents remain available, and the activation agreement stays unchanged.

[Read the complete design plan](design-plan.md) for copy, dimensions, responsive behavior, routes, failure states, accessibility, and future acceptance criteria. [Simple-flow generation prompts](mockup-prompts-simple-flow.md) record the current refinement. The [website-copy prompts](mockup-prompts-website-copy.md), [original prompts](mockup-prompts.md), and prior artwork remain historical revisions. Sign-in and activation actions keep their app labels; the marketing screenshot's Download free and See pricing actions are not part of this flow.

## Simple product flow

![Standalone simple flow concept](06-simple-flow.png)

The three nodes read **Your agents**, **Thermus**, **The web**. Four direct arrows show **Request + reason** from agents to Thermus in solid Cream `#F3F2EE`; **Approved** from Thermus to the web in solid Cream; **Raw pages** from the web to Thermus in dashed Red `#FF6B5A`; and **Clean** from Thermus to agents in solid Green `#7FD1AE`. Only Thermus has an orange outline. Give labels clear connector space, with no overlap or small type. No inner feature boxes, logging, legend, background headline, numbered steps, or MCP pill are needed.

The [user's flow screenshot](flow-reference.png) is the conceptual source. The response passes through Thermus on its return; no arrow bypasses it. This diagram does not introduce a backend approval gate or claim new implementation behavior.

## Home

![Home desktop simple-flow concept](01-home-desktop-simple-flow.png)

## Signup before sign-in

![Signup entry desktop concept](02-signup-entry-desktop.png)

## Hosted sign-in

![Hosted sign-in desktop simple-flow concept](03-signin-desktop-simple-flow.png)

## Signup after sign-in

![Signup activation desktop concept](04-signup-activation-desktop.png)

## Mobile

![Three mobile website-copy concepts](05-mobile-review-website-copy.png)

Mobile omits the diagram and keeps the existing website-copy concepts.

The mockups are visual references. The plan and source brand assets govern exact typography, flat color values, document text, and final controls. The live WorkOS theme has not been changed. The authenticated portal and workspace selector are outside this first mockup set.

