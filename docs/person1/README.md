# Person 1: evidence retrieval, validation, and citations

Owner: Person 1. Integration owner: the teammate coordinating the main system.
Time budget: approximately one hour for a standalone prototype.
Implementation repository: `Elena549-prog/Claude_Hackathon_Berlin`.

## Assignment

Build a working prototype that searches the internet for medical evidence,
checks whether retrieved content supports specific claims, and returns
traceable evidence with clickable citations. Support qualitative evidence and,
when available, candidate numerical inputs for the separate probability module.

You own planning and implementation: choose the source policy, framework,
prompts, retrieval strategy, and research/checking workflow. Conduct your own
short interview with your teammate if essential decisions are missing. This
brief defines outcomes; it does not prescribe the internal architecture or a
final input schema.

Claude with Tavily is the proposed starting point. Ordinary Claude SDK calls
are sufficient; the Anthropic Agent SDK is optional. LangChain or LangGraph is
acceptable if it helps you deliver within the time budget. Prefer separate
research and checking steps; these may use the same model in separate calls.
Agreement between models alone does not establish source support.

## Scope and ownership

- Own discovery, source-content retrieval, claim checking, evidence records,
  citation provenance, tests, and the standalone demonstration.
- Choose and document suitable medical sources, including official guidelines,
  reviews, and original studies. PubMed is a possible discovery source; record
  whether you actually accessed an abstract or full text. Search snippets are
  discovery material, not sufficient support for a validated claim.
- Define and document a small request/response interface for later integration.
  There is no supplied orchestrator input contract yet. Your example request
  should demonstrate what information the caller needs to provide.
- The integration owner connects your prototype to the orchestrator and UI.
  Person 2 owns medical coding only. Person 3 owns orchestration, integration,
  and the numerical engine. Deliver provenance and candidate numerical inputs;
  calculation and approval of numerical eligibility belong to Person 3's
  separate workflow.
- Keep literature evidence distinct from patient observations and test results.
  Finding another paper does not constitute a new positive patient test.

## Definition of done

- [ ] A documented command runs the prototype independently, with setup and
  required environment-variable names explained and no committed credentials.
- [ ] One live retrieval demonstration uses an existing Arbor presentation.
- [ ] Each claim marked supported has a resolvable source reference, a clickable
  source URL, the actual retrieved passage, and a brief reason it supports that
  exact claim. URLs and passages come from retrieval artifacts, not generated
  guesses. Record source identity, retrieval time, and access level.
- [ ] Results distinguish supported, contradicted, insufficient evidence, and
  inaccessible content. Relevant applicability limitations are explicit.
- [ ] Candidate numerical evidence preserves available population, setting,
  units, denominator, thresholds, and uncertainty. Missing context is identified;
  a supported quotation alone does not authorize a probability calculation.
- [ ] Missing evidence, timeout, provider failure, and malformed output produce
  an explicit incomplete/failure outcome, without invented citations or silent
  promotion to supported. Document request limits and retry behavior.
- [ ] Example requests/responses, repeatable tests requiring no API keys, and
  integration instructions are included. Explain source/claim identifiers and
  how a caller resolves each citation to its stored source.
- [ ] The handoff reports which checks pass, what remains incomplete, and known
  limitations. A prototype passing these checks is not clinical validation.

## Acceptance cases

Use fixed retrieved-content fixtures with expected outcomes so tests are
repeatable. Check observable results through the proposed interface.

1. An accessible passage supports the exact claim; the returned citation opens
   the corresponding source and the passage can be traced to retrieved content.
2. A related medical page that does not support the claim is not marked supported.
3. A claim with an incorrect number, unit, population, or qualifier is not marked
   supported; the discrepancy is explained.
4. A claim attached to the wrong source is not marked supported, even if the
   source looks authoritative or the URL opens successfully.
5. Conflicting retrieved sources remain visible with the disagreement explained;
   the prototype does not silently select or average them into certainty.
6. Paywalled, inaccessible, and abstract-only material is labeled accurately.
   Only inspected content can support a claim; an abstract may support only what
   it actually states. Unseen full text is never represented as inspected.
7. No useful evidence or a retrieval failure yields an explicit incomplete result;
   usable partial evidence may remain, with missing coverage identified.
8. Repeated retrieval of the same study does not count as independent
   corroboration or create another patient observation.
9. Placeholder links and instructions embedded in retrieved pages cannot become
   trusted clinical evidence or override the research/checking instructions.

All acceptance cases must have recorded expected and actual outcomes. Report
failures honestly rather than relaxing the definition of supported.

## Reference material

Existing Arbor: <https://github.com/pragnesh-gh/corti-dx-arbor>.
It may also be available locally as a sibling directory named `corti-dx-arbor`.
Use it as reference; its current Corti provider stack is not required here.

Start with `CONTEXT.md`, `web/src/scenarios.ts`, and `web/src/tutorialCase.ts`.
The guided tour uses fever and migrating joint pain after a sore throat; the
quick sore-throat presentation is a simpler alternative for a live demo.

The guided tour is scripted and predates grounded citations. Its claims,
probabilities, and citation labels are not verified answers. It includes
`example.org` placeholder links: these are useful negative test cases.

For additional context, consult `docs/research/anthropic-tavily-arbor-proposal.md`,
`docs/research/diagnostic-probability-model.md`, and
`docs/adr/0003-grounded-inline-citations.md` in that reference repository.
These contain proposals and historical decisions, not extra approved scope.

## Start a fresh Claude session

Open this repository and paste:

> Read `docs/person1/README.md`. This is your assignment brief with agreed
> outcomes. I have approximately one hour. Inspect the reference material,
> ask me only essential questions, recommend a simple plan, then build and
> verify the standalone prototype. Choose the source policy, framework,
> prompts, and internal workflow. Preserve the acceptance criteria. Deliver
> example inputs/outputs, repeatable tests, and integration instructions.
> Another teammate will connect this to the main system afterward.
