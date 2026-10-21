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
with the final code, contracts, configuration, and relevant tests. Inspect the
actual behavior; do not infer a component or a dependency from folder names.

Update affected entries and diagrams when the change alters:

- A component or subcomponent, its responsibility, or its boundary.
- A dependency, public contract, or resource owner and lifetime.
- An external service or a trust boundary.
- A meaningful design pattern or architecture risk that the map explains.

Describe semantic and runtime dependencies, such as a call through an injected
interface, an event, or shared storage. Distinguish these from source imports.
An import graph alone does not establish runtime collaboration. Link important
claims to the source, contract, configuration, or test that supports them. Keep
the diagram and the component entries consistent; omit internal detail that
does not help a reader understand the system.

## Finish the pull request

After code and review fixes, add a concise **Architecture impact** section to
the pull request description. State what changed in the registry and why, or
state why the final change leaves the map accurate. Do not edit the registry
merely to show that you checked it. Do not copy the pull request history into
it.

After a later fix, check its architecture impact again and update the registry,
diagrams, and pull request explanation when needed. Before Ready, requesting
human review, or enabling any merge automation allowed by the existing policy,
recheck the complete candidate against the registry. Complete the existing
tests, metrics process, review route, and required human decisions as usual.
An updated map records facts; it cannot bless a forbidden dependency, waive a
check, or serve as self-approval.
