# Maintain the component registry

The LLM that implements or reviews a change maintains
[architecture/components.md](../../architecture/components.md). The registry
and its Mermaid diagrams describe the current system. They are a curated map,
not a change log or a plan. Keep planned work separate and label it as planned.

The registry does not authorize architecture changes. The
[review rules](pr-review-rules.yaml) remain the authority for declared import
edges, public surfaces, and review routes. This workflow has the same
protected-path policy review as [AGENTS.md](../../AGENTS.md). Follow AGENTS.md
for all test, metrics, review, approval, and merge requirements. This guide adds
no automated gate and does not authorize automatic merge or agent approval of
a change that needs a human decision. The owner decides whether a draft decision
becomes a record under `architecture/decisions/`.

## Check the change

Read the current registry before you implement or review a change that can
affect its map. After implementation and review fixes, compare that baseline
with the final code, composition, public contracts, configuration, and relevant
tests. Follow supplied roles, events, shared storage, and resource ownership.
An import graph alone does not establish runtime collaboration. Folder names
alone do not establish components. Link important claims to their evidence.

The baseline uses selected arc42 sections: context (3), building blocks (5),
runtime (6), and deployment (7), with C4 conventions in ordinary Mermaid.
Routine maintenance keeps those views and the small collaboration overview.
Add views only when they explain an important architecture change. Keep useful
detail without filling the full arc42 template or tracing every call. Do not
add a model or tool chain merely for this check.

Use this table to select affected views. A change can affect more than one row.
Check adjacent views and their text even when their diagrams need no edit.

| Change | Views and registry content to check |
| --- | --- |
| Person, external system, system purpose, or trust boundary | Context; related containers and runtime scenarios |
| Application, process, datastore, provider, or edition boundary | Hosted/local containers; source-owner mapping; affected components, runtime, and deployment |
| Component responsibility, public contract, or collaboration | Ownership entries; component views; collaboration overview; affected runtime scenarios |
| Access rule, ordering, outcome, shared resource, or lifetime | Runtime scenarios; behavior and resource ownership; related components and containers |
| Host, instance, storage mount, ingress, or process placement | Deployment; affected containers, ownership, configuration evidence, and limits |
| Design choice or architecture risk | Relevant views and text; design choices and current soft spots |

Update affected entries, mappings, diagrams, and overview together. Remove stale
elements, relationships, and source references. Keep unaffected views; do not
regenerate the full registry for each change.

## Keep the views consistent

Keep logical registry IDs stable. Use consistent entity names and source-owner
to container mappings across views. Mermaid node and participant IDs can be
scoped to each view; existing prefixes do not need to match across diagrams.
Keep source owners, C4 containers, and deployment nodes distinct: a source
folder is not a C4 container, and a C4 process can share a Docker container with
another process. Keep editions distinct as the current code defines them.

Check the links between levels:

- Context shows Thermus as one system and its people and external systems.
  Container views break that system into applications, processes, and
  datastores and retain the relevant external relationships.
- Each component view has one container as its scope. Place supporting
  containers and external systems outside that boundary. Match components to
  the stable owners and the source-owner to container mapping.
- Runtime participants refer to those components, containers, or external
  entities. Explain supplied roles and groups, and map them to their owners
  or selected implementations. A group or role does not add a source owner.
- Deployment places those same containers on hosts or instances, with relevant
  storage and connections. Distinguish source-defined topology, a dated
  recorded target, and live observations. State unknowns; this workflow does
  not require live cloud calls or turn a recorded target into live evidence.

Give each diagram a type and scope in its heading or adjacent text, with clear
relationship directions and meanings. Context focuses on people and system
relationships; the compact overview can use explained groups. In C4 container,
component, and deployment views, identify types and responsibilities, add useful
technology detail, and label protocols between processes. Distinguish
construction, source imports, and runtime calls through supplied roles.

Show and check actual runtime order and observable results against the final
code. Include relevant access and trust checks, success and failure paths,
cancellation, shared state, resource acquisition, and cleanup. Keep scenarios
focused on architectural behavior rather than exhaustive call tracing.

Before finishing, compare all affected views and their text once more:

- Names, boundaries, owner mappings, relationships, and edition choices agree.
- Runtime scenarios and deployment placement agree with the static views and
  the cited evidence. Assumptions and evidence limits are explicit.
- Source links and local Markdown links resolve; removed elements have no
  stale references in the affected views or text.
- Parse and render each changed Mermaid diagram with an available supported
  renderer. Inspect the result for readable labels, scope boundaries, arrows,
  and sequence order. Fix syntax and rendering defects before recording the
  tool and result, including any limitation. No repository dependency change
  is required for this validation.

## Finish the pull request

After code and review fixes, add a concise **Architecture impact** section to
the pull request description. Name the views changed or checked, the supporting
evidence, and the validation results and limitations, including the Mermaid
tool when diagrams changed. If no registry edit is needed, state why the final
change leaves those views accurate. Do not edit the registry merely to show
that you checked it. Do not copy the pull request history into it.

After a later fix, check its architecture impact again and update the registry,
diagrams, and pull request explanation when needed. Before Ready, requesting
human review, or enabling any merge automation allowed by the existing policy,
recheck the complete candidate against the registry. Complete the existing
tests, metrics process, review route, and required human decisions as usual.
An updated map records facts; it cannot bless a forbidden dependency, waive a
check, or serve as self-approval.
