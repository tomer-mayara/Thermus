export const truncatedLayerReview = [
  '## AST Metrics review', '',
  'Thermus review policy: new-function warnings require >10 paths; high starts at 25. Approved layer rules use CR-13 resolved imports.', '',
  'Regressions: 2 high, 0 medium, 0 low. Improvements: 0. Gate: failed.', '',
  '### Regressions', '',
  '- **high**: Forbidden component dependency: src/html-cleaner-pipeline/source.ts → src/mcp/target.ts (`src/html-cleaner-pipeline/source.ts`, rule `forbidden-component-dependency`)',
  '  Remove the dependency or move this collaboration to an allowed component.', '',
  '1 more regression(s); the JSON report retains all findings.', '',
].join('\n');
