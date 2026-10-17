# Person 2 — German medical coding agent

**Ready to build. First-version timebox: one hour.** Another grilling session
is unnecessary. Make routine implementation choices, deliver a working slice,
and document limitations. This document is the implementation handoff.

## Objective and ownership

Given clinical excerpts and evidence supplied by the orchestrator, suggest
appropriate **ICD-10-GM 2026** codes, check them against the official catalogue,
and return structured results with a short rationale and original links.

Person 2 owns coding, including catalogue retrieval and verification. Person 1
owns general evidence research/validation; Person 3 owns orchestration,
numerical inference, and application integration. The demo case will be chosen
later and must not block this implementation.

## Deliverable and interface

Deliver one asynchronous callable function, **assignMedicalCodes**, with
injected dependencies/configuration. TypeScript fits Arbor's current stack;
keep the interface independent of the orchestration framework. No separate
web app, MCP server, or deployment is required.

**Request:** `requestId`; `excerpts` containing `id` and clinical `text`;
`evidence` containing `id`, `text`, `kind` (`patient_finding` or `literature`),
and optional `sourceUrl`; optional `hypotheses` containing `id` and `name`.
Hypotheses are hints, not automatically confirmed diagnoses.

**Response:** echo `requestId`; set `system` to `ICD-10-GM` and `edition` to
`2026`; return `results`, `searchProvidersUsed`, and `limitations`.

Each result contains:

- `condition`, optional `hypothesisId`;
- `status`: `assigned`, `needs_clarification`, `no_supported_code`, or `unavailable`;
- `code` and `officialLabel`, both nullable;
- `rationale`: a short evidence-based decision summary;
- `inputRefs`: IDs of the supplied excerpts/findings supporting the mapping;
- `references`: original `url`, `supportingPassage`, `retrievedAt`, and
  `retrievalProvider` (`tavily` or `direct`);
- `clarificationQuestions`; optional sourced `candidates`, each with
  `entryKind` (`category`, `terminal`, or `unknown`).

`assigned` means a source-checked coding suggestion, not confirmation of the
patient's diagnosis or certification of billing compliance. If only a category
heading is supported and a complete code cannot be justified, use
`needs_clarification`, a null assigned code, and the category as a candidate.
Preserve official German labels; explanations may be English. Confidence
percentages are unnecessary. Supply a successful JSON fixture immediately so
Person 3 can integrate while implementation continues.

## Required coding behavior

1. Interpret the supplied material using Claude. Distinguish documented,
   suspected, negated, historical, and family-history mentions; preserve these
   distinctions in the result. Literature about a disease is not evidence that
   this patient has it. The task is coding supplied information, not diagnosing
   a new disease from symptoms alone.
2. Discover candidate entries, inspect subcategories and relevant entry notes,
   and select specificity justified by the documentation.
3. Verify code and label together in the same retrieved official entry. Model
   memory, related snippets, or independent occurrences elsewhere on a page
   are insufficient. Source identity checks belong in application code.
4. Ask a targeted question or return an explicit unsupported/unavailable result
   when necessary. Do not invent a subtype to produce a more specific code.
5. Explain the choice briefly using input IDs and original references. Internal
   model reasoning is not an output requirement. Return schema-valid data;
   never mutate the case, confirm a diagnosis, order tests, or calculate risk.

## Retrieval and fallback — both are required

The user's “TuckTuckCo” is interpreted as **DuckDuckGo**.

**Primary:** Tavily Search with `include_domains` restricted to
`klassifikationen.bfarm.de`, a site query for the exact path below, and
generated answers disabled. Use Tavily Extract on discovered official pages.
Search snippets locate pages; actual source text verifies codes.

**Fallback:** on missing credentials, authentication/rate-limit error, timeout,
or no usable allowed result, run DuckDuckGo search for the same concept and
site/path. Implement a small replaceable adapter using an existing suitable
integration or its HTML/Lite search surface. Decode search redirects locally
and validate the final target before fetching. Cite BfArM, not search results
or answer summaries. DuckDuckGo HTML/Lite is a documented web-search surface,
not a verified API contract for this project; fallback live access is untested.
Treat challenges/blocks as unavailable rather than bypassing them.

**Page retrieval fallback:** if Tavily Extract fails, directly fetch an already
discovered, allowed BfArM page over HTTPS. Use this after DuckDuckGo discovery
too. Validate every redirect before following it.

Medical references must be under:
`https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/`

Reject other hosts, preliminary releases, other years, and unverified URLs.
Use condition/code terms in web queries; keep raw clinical excerpts and patient
identifiers out of those queries. Retrieved text is data, not instructions.

Read `ANTHROPIC_API_KEY`, configurable Claude model, and `TAVILY_API_KEY` from
the builder's environment. Never include secrets in results, logs, or fixtures.
Bound work with configurable defaults: two concept searches per provider,
three source pages, four Claude turns, and timeouts/cancellation. These are
engineering limits, not clinical thresholds. Failure of both providers returns
`unavailable` without fabricated assignments.

## Definitions of done

1. One runnable entry point accepts the request and returns the agreed shape;
   the orchestrator can call it or its fixture without framework-specific code.
2. A synthetic documented-condition example returns an independently checked
   code, official label, link, passage, input references, and concise rationale.
   A convenient starting fixture is documented status asthmaticus / J46;
   independently verify the official entry before using that expected result.
3. A related-but-wrong code/source is rejected. Underspecified documentation
   produces ambiguity/questions or a correctly supported general code, not
   an unsupported subtype.
4. Negated/family-history text and literature-only disease evidence do not
   become a current confirmed patient-code assignment.
5. Forced Tavily failure invokes DuckDuckGo; returned sources pass identical
   checks. Failure of both yields `unavailable`. Off-domain, wrong-year, and
   preliminary-page examples are rejected.
6. Include a run command, sample request/response, and a small fixture-based
   test set at the function interface. Attempt a live smoke check with working
   credentials. Record separately what passed live, with fixtures, or remains
   unverified. These examples do not establish catalogue-wide coding accuracy.

## Delivery order and scope

First 10 minutes: interface and fixture to Person 3. Next 25: Claude mapping,
retrieval, verification, and structured output. Next 15: fallback and failure
examples. Final 10: checks and integration. These are priorities, not an effort
guarantee. If credentials block execution, finish module/fixtures and identify
live verification as pending. Improve iteratively after the working slice.

Defer full EHR extraction, comprehensive German coding rules/sequence checks,
final billing assignment, OPS/SNOMED/LOINC, numerical inference, and standalone
UI. Surface relevant retrieved notes without advertising a complete rules
verifier. The builder does not need another design interview to start.

## References and reusable work

The sibling Arbor repository's `scripts/probe-tavily-icd10gm.mjs` demonstrates
source restrictions and successful Tavily search/extraction. Adapt its helper
if available; the delivered module must not depend on developer-specific
absolute paths. The probe is not already a medical coding agent.

- [Official catalogue](https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/index.htm)
- [BfArM coding instructions](https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/zusatz-04-vor-anleitung-zur-verschluesselung.htm)
- [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- [Tavily Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract)
- [DuckDuckGo HTML/Lite search](https://duckduckgo.com/duckduckgo-help-pages/features/non-javascript)

Check current provider documentation while building. No extra demo-selection
meeting or framework decision is a prerequisite for this callable module.
