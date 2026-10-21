## Review tier

Tier: <T0 Auto merge / T1 Team review / T2 Need architect>
Candidate: <head SHA>
Impact declaration: <link to committed root .pr-impact.json at this head>
Reasons: <all matching reasons; approved de-escalation evidence if any>
Eligibility and blockers: <preliminary result; all unresolved blockers>

## Architecture impact

Model updated: <yes/no; changed or checked views and canonical names>
Delta: <relevant changes, or why current views remain accurate>
Evidence and validation: <source/test links; Mermaid tool and result if changed>

## Checks and metrics

Applicable checks: <results for this candidate; trusted N/A reasons>
Relevant metric findings: <changed file/function findings or N/A>
Reports and exceptions: <retained artifact links; reviewed exception evidence>

## Additional evidence for T2 Need architect

Container/external changes: <what changes, or none>
Deployment, security, and data impact: <guarantees and recovery effects>
Decision: <ADR for a lasting decision, or why none is needed>

<!-- Update and commit root .pr-impact.json with version, classification, and
architecture; it must differ from the trusted base. The manager or Delamain session stamps
actual base/head identities in the local check input. For local --impact checks, use a stamped copy as
the checker guide specifies. PR body prose cannot replace the committed input.
Labels record the tier; they do not establish eligibility. De-escalation needs manual
higher-authority review/merge and all checks. Human approval and final
eligibility come from the trusted process, not this template or a label. -->
