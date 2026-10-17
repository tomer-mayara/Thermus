# Simple flow revision — image prompts

Method: built-in image generation tool, editing the current page mockups and simplifying the [user's flow reference](flow-reference.png). These are design artifacts only. Earlier images and prompts remain as previous revisions.

The diagram has three boxes: Your agents, Thermus, The web. White outgoing arrows are labeled Request + reason and Approved. The green return is labeled Clean. The dashed red return is labeled Raw pages. Both return paths pass through Thermus. No Markdown label or internal feature boxes are included.

## 06-simple-flow.png

```text
Use case: infographic-diagram; simplified UI diagram from a supplied reference.
Image1 is the detailed Thermus flow diagram reference: use its flow semantics. Image2 is the current portal UI: use its restrained colors, typography and three-box style. Create a NEW STANDALONE simplified diagram only, no webpage, headline, footer, login form or explanatory paragraph. Flat front-facing crisp vector-like appearance, wide3:1 landscape composition, solid background #141519, no gradients/glow/texture/shadows.
EXACTLY THREE rounded rectangular nodes, one row, labels from left to right: "Your agents", "Thermus", "The web". Neutral card fill #212228; side node borders #43454E; ONLY Thermus node has thin #E8552A orange outline. All node titles cream #F3F2EE IBM Plex Sans semibold, comfortably readable. Nodes similar size, about160px wide and104px high, generous200px gaps for connectors. Lots of air, crisp2px strokes,8px corner radius.
FOUR separate direct horizontal arrowed connectors, TWO inside each gap. No line bypasses Thermus.
Left gap TOP: WHITE solid arrow from Your agents right edge TO Thermus left edge pointing RIGHT. Above this arrow place the exact white label "Request + reason" in readable IBM Plex Mono.
Right gap TOP: WHITE solid arrow from Thermus right edge TO The web left edge pointing RIGHT. Above this arrow exact white label "Approved".
Left gap BOTTOM: GREEN #7FD1AE solid arrow from Thermus left edge TO Your agents right edge pointing LEFT. Below this arrow exact green label "Clean".
Right gap BOTTOM: RED #FF6B5A dashed arrow from The web left edge TO Thermus right edge pointing LEFT. Below this arrow exact red label "Raw pages".
The two arrow lanes attach to upper/lower parts of node sidewalls. All labels lie in the connector gaps, never overlap nodes/arrows. Arrows obvious open arrowheads; white outgoing on top and colored incoming below. No crossings. No gray or orange outbound arrows. Return red is dashed, return green solid.
Do NOT include Markdown, MD, MCP pill, numbered dots, key/legend, log line, internal feature boxes, SIEM or any other words. Exactly7text labels:3nodes +4connectors. Preserve the important meaning of the detailed reference while making this extremely simple and legible.
```

## 01-home-desktop-simple-flow.png

```text
Use case: precise-object-edit / UI diagram revision.
Image1 EDIT TARGET: Thermus portal desktop home with approved website copy. Image2 reference: full detailed Thermus flow diagram. Change ONLY the compact diagram in the LOWER LEFT of image1. Preserve absolutely everything else in image1 including exact marketing headline, eyebrow, supporting paragraph, logo, card, buttons, footer, dimensions, colors and layout.
Replace the compact diagram with this simple accurate3rectangle flow:
Keep the same enclosing dark panel and use exactly3rounded boxes in a horizontal row: "Your agents", "Thermus", "The web". Orange outline only on Thermus, neutral outlines on side boxes. Make the boxes a little narrower if needed to leave130–160px connector gaps. Keep all diagram text legible at12–14px equivalent, no overlaps.
There are exactly FOUR directed arrows:
TOP LEFT gap: solid WHITE #F3F2EE right-pointing arrow Your agents→Thermus, label above it "Request + reason". Wrap this label into2lines only if needed, never omit reason.
TOP RIGHT gap: solid WHITE right-pointing arrow Thermus→The web, label above it "Approved".
BOTTOM LEFT gap: solid GREEN #7FD1AE left-pointing arrow Thermus→Your agents, label beneath it "Clean".
BOTTOM RIGHT gap: dashed RED #FF6B5A left-pointing arrow The web→Thermus, label beneath it "Raw pages".
Use two separated arrow lanes between each pair of boxes. Label colors match their arrow colors. Arrows enter/leave actual node sidewalls. Never connect Web directly to agents. No internal details, numbers, log stream, legend, icons or MCP pill.
Remove the old "Cleaned Markdown" and "Raw page" labels. The final diagram has only seven labels:3nodes plus4connectorlabels. It must read unambiguously: Request+reason goes into Thermus, approved requests go to the web, raw pages go back into Thermus, clean content goes back to agents.
Do not copy the detailed diagram's headline or feature boxes. Use only its flow meanings. Everything outside the small diagram is unchanged. Flat crisp realistic webpage mockup, no watermark.
```

## 03-signin-desktop-simple-flow.png

```text
undefined
```


