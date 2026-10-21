export const productFlow = `
  <svg class="product-flow" viewBox="0 0 590 142" role="img" aria-label="Your agents send Request + reason to Thermus. Thermus sends Approved requests to The web. The web returns Raw pages to Thermus. Thermus returns Clean content to Your agents.">
    <defs>
      <marker id="flow-forward" markerWidth="7" markerHeight="9" refX="6" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L5 4.5 L1 8" /></marker>
      <marker id="flow-raw" markerWidth="7" markerHeight="9" refX="6" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L5 4.5 L1 8" /></marker>
      <marker id="flow-clean" markerWidth="7" markerHeight="9" refX="6" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L5 4.5 L1 8" /></marker>
    </defs>
    <g class="flow-node"><rect x="18" y="43" width="106" height="58" rx="7" /><text x="71" y="78">Your agents</text></g>
    <g class="flow-node flow-thermus"><rect x="245" y="43" width="100" height="58" rx="7" /><text x="295" y="78">Thermus</text></g>
    <g class="flow-node"><rect x="467" y="43" width="105" height="58" rx="7" /><text x="519.5" y="78">The web</text></g>
    <path class="flow-arrow flow-outbound" d="M130 61 H239" marker-end="url(#flow-forward)" />
    <path class="flow-arrow flow-outbound" d="M351 61 H461" marker-end="url(#flow-forward)" />
    <path class="flow-arrow flow-raw" d="M461 85 H351" marker-end="url(#flow-raw)" />
    <path class="flow-arrow flow-clean" d="M239 85 H130" marker-end="url(#flow-clean)" />
    <text class="flow-label" x="184.5" y="35">Request + reason</text>
    <text class="flow-label" x="406" y="35">Approved</text>
    <text class="flow-label flow-raw" x="406" y="121">Raw pages</text>
    <text class="flow-label flow-clean" x="184.5" y="121">Clean</text>
  </svg>
`;
