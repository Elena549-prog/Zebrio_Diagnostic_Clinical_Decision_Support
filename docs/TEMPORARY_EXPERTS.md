# Temporary Claude expert adapters

> **Coding is no longer temporary.** `server/index.ts` now calls the Person 2
> module (`medical-coding-expert/`) through `server/experts/coding.ts`. The
> coding adapter in `server/experts/index.ts` is unused by the app and kept only
> for its tests. Run `npm run eval` in `medical-coding-expert/` for the live
> 15-case evaluation. The evidence adapter below is still temporary.

These replace Corti registry dependencies until the Person 1 evidence module and
Person 2 coding module arrive. The application uses ordinary asynchronous
functions, with no hosted Corti agents or registry calls.

## Callable interface

```ts
import { researchEvidence, assignMedicalCodes } from './server/experts/index.js';

const evidence = await researchEvidence(caseState, { signal });
const codes = await assignMedicalCodes({
  requestId: 'case-1-round-2',
  excerpts: [{ id: 'presentation', text: 'Synthetic clinical excerpt supplied by the clinician.' }],
  evidence: [{ id: 'f1', kind: 'patient_finding', text: 'A documented patient observation.' }],
  hypotheses: [{ id: 'h1', name: 'Asthma' }],
}, { signal });
```

`researchEvidence` returns `{ sources, findings, status, limitations }`.
Finding `sourceRefs` refer to local source IDs such as `N1`; the application's
existing source-pool merge maps these to stable numbered citations. Findings
have `supported`, `contradicted`, `insufficient`, or `inaccessible` validation
status. A contradiction is preserved rather than silently averaged away.
Retrieved content is literature, not a new patient result.

`assignMedicalCodes` follows `docs/person2/SPEC.md`: `requestId`, system,
edition, results, providers used, limitations. Each result has status, nullable
assigned code/official label, input IDs, rationale, original references,
clarification questions, and optional sourced candidates. `assigned` is a
coding suggestion, never confirmation of a patient's diagnosis. Suspected,
historical, negated, family-history, and literature-only concepts do not become
assigned current-disease codes in this temporary implementation. This deliberately
does not implement all legitimate German coding conventions for those contexts.

## Workflow and models

Evidence uses a `researcher` Claude call to plan generic clinical queries,
bounded Tavily Search/Extract, then a separate `validator` Claude call. The
runtime chooses model IDs via the environment; the intended split is a small
research model and a stronger validator. Coding uses the `coding` model for
concept interpretation and source-grounded mapping.

The original Arbor evidence coordinator's principles are retained: primary
sources, concise directional findings, and explicit absence when research
returns nothing. Corti's private registry web expert's internal prompt is not
available in this repository and has not been copied or reproduced.

## Retrieval boundaries

- `TAVILY_API_KEY` is read server-side. Tavily-generated answers are disabled;
  relevance scores are unused. Only extracted content can back a claim.
- Evidence searches are restricted to configured medical publishers/agencies
  in `server/experts/retrieval.ts`. This is a starting source policy, not an
  endorsement of every page on those domains.
- Web search terms are filtered to a fixed clinical vocabulary and ICD-shaped
  tokens. Raw narrative, patient names, record numbers, URLs, and identifiers
  are not forwarded as web queries. This conservative vocabulary sacrifices
  recall; specialist names absent from it require deliberate extension.
  Clinical excerpts are still sent to the configured Claude API for the task.
- Coding sources must be HTTPS pages inside the official BfArM ICD-10-GM 2026
  catalogue. Other hosts, years, preliminary editions, encoded paths, and
  redirector query strings are rejected in code.
- Coding falls back to DuckDuckGo HTML discovery when Tavily is missing or
  fails, then fetches discovered official pages directly. Every redirect is
  checked before following. Bot challenges are unavailable, never bypassed.
  DuckDuckGo HTML is an unofficial adapter surface and can stop working.
- At most two searches per provider and three retrieved pages per call. The
  retrieval budget is 45 seconds with 12-second request timeouts, bounded
  response sizes, and caller cancellation. Each role uses at most two model
  calls in this adapter; model request timeouts live in the shared runtime.
- Evidence allows two model calls with combined output ceilings of 2,800
  tokens; coding allows two with ceilings of 3,200. Up to three pages of 45,000
  characters each can enter validation. Input tokens and configured model prices
  determine actual cost; this is a request/token bound, not a fixed monetary
  guarantee. SDK transport retry settings can cause an additional API attempt.
- `TEMPORARY_EXPERT_CAPABILITIES` exports non-secret roles, retrieval limits,
  source policy, edition, fallback providers, and validation limitations for
  inspection. All expert instructions are visible in `server/experts/index.ts`.
- Upstream error bodies and credentials never appear in return values.

## What is checked deterministically

Evidence citations name an actually retrieved source and contain an exact
whitespace-normalized passage from that source. An unknown source or invented
passage is downgraded to insufficient. The validator cannot create URLs.

Coding requires the actual code and full official label together at an entry
heading, with a matching quoted passage. A category is a candidate, not a final
terminal assignment. Truncated entries without an inspectable next-code
boundary remain unknown. This is a conservative text parser; it may decline
correct codes when catalogue formatting is unfamiliar.

These checks prove provenance, not semantic or clinical accuracy. A model can
still misinterpret an excerpt, select an inapplicable passage, or misjudge
clinical relevance. There is no comprehensive German rules/sequence verifier,
population applicability approval, catalogue-wide coding accuracy claim, or
clinical validation. Missing keys, malformed model output, failed retrieval,
and cancellation never create invented medical facts or sources. Diagnosis
probabilities and evidence eligibility for numerical inference belong to the
separate deterministic engine.

## Verification and replacement

Run credential-free fixture tests:

```sh
npx tsx --test server/experts/*.test.ts
```

Twelve tests cover citation spoofing, quote mismatch, full-label entry matching,
missing terminal boundaries, suspected diagnoses, literature-only input,
Tavily failure and DuckDuckGo/direct fallback, blocked challenges, redirect
boundaries, cancellation, identifier filtering, and secret redaction.
Catalogue labels in parser fixtures are intentionally synthetic: these are
adapter tests, not evidence that any clinical coding answer is correct.

The implementation agent used credential-free fixtures. Subsequent independent
live checks exercised all configured Claude models and one integrated round
with Tavily retrieval; see [LIVE_VERIFICATION.md](LIVE_VERIFICATION.md). Coding
returned no supported assignments in that run, so a positive live assignment
remains unverified. Neither these fixtures nor the live smoke constitute
clinical evaluation. The fixture tests consume no Tavily credits.

Replace either function independently when teammates deliver their modules.
Keep original retrieved provenance and validation status through the existing
case source pool. Person 1's implementation must preserve its acceptance cases;
Person 2's implementation must preserve `docs/person2/SPEC.md`. No frontend or
orchestration-framework changes are required by these function boundaries.
