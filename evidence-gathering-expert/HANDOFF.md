# Evidence Gathering Expert — handoff

Person 1's module. Design: [SPEC.md](SPEC.md). Brief: [docs/person1/README.md](../docs/person1/README.md).

Given a pseudonymised patient presentation, it finds medical papers, extracts the
numbers a probability calculation needs (base rates, likelihood ratios,
sensitivity, specificity), and proves each number with a URL and an exact quote
from text it actually retrieved. It never calculates a probability.

**This is a prototype, not clinical validation.**

## Setup

```bash
cd evidence-gathering-expert
npm install
```

Environment (in `.env.local` at the **repo root**, git-ignored):

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes, for live runs | Claude calls (analyse, check, double-check) |
| `EVIDENCE_MODEL` | no | Model override; default `claude-sonnet-5-5` |

Europe PMC, PubMed and DuckDuckGo need no key. Tests need no key and no network.

## Commands

```bash
npm test                                             # 54 tests, no keys, no network
npm run typecheck
npm run evidence -- examples/sore-throat.request.json  # live run; JSON on stdout, summary with links on stderr, saved to out/<requestId>.json
npx tsx --env-file=../.env.local scripts/trace-live.ts # live run with a full request/model trace in out/trace.json
```

## Integration (Person 3)

```ts
import { gatherEvidence, anthropicClient } from "./evidence-gathering-expert/src/index.js";

const response = await gatherEvidence(request, {
  llm: anthropicClient({ model: process.env.EVIDENCE_MODEL }),
  fetch,                       // inject your own for tests
  config: { requestBudgetMs: 180_000 }, // optional overrides, see DEFAULT_CONFIG
});
```

- Request shape: `examples/sore-throat.request.json`. Response shape: `src/types.ts`
  (`EvidenceResponse`). A hand-written integration fixture is in
  `examples/sore-throat.fixture.response.json` (marked FIXTURE; do not use its numbers).
  A real live response is in `examples/sore-throat.response.json`.
- **For the probability step:** per diagnosis, read `prior` and `likelihoodRatios[]`.
  Use a number only when its item's `status` is `supported`. Anything unverified is
  `null` and listed in `missing`; `note` explains discrepancies and second-check
  disagreements. Several supporting studies are never averaged: the best-ranked one
  supplies the values and `note` lists the others.
- **Resolving a citation:** `evidenceIds` → `evidence[].id`; `evidence[].sourceId` →
  `sources[].id`. `evidence[].url` / `sources[].url` is the real page the text came
  from (Europe PMC, PubMed or a guideline site); `sources[].doiUrl` when a DOI exists.
  `accessLevel` says what we actually read (`full_text`, `abstract_only`, `paywalled`,
  `inaccessible`).
- **Feeding Person 2 (`assignMedicalCodes`):** `diagnoses[]` → `hypotheses`
  (`id`, `name = diagnosis`; they are model suggestions, not confirmed);
  `patientFindings[]` → `evidence` with `kind: patient_finding`;
  `evidence[]` → `evidence` with `kind: literature`, `text = passage`, `sourceUrl = url`.
- **Open for Person 3:** confirm `presentation` vs Person 2's `excerpts[]` request
  shape, and that `prior` / `likelihoodRatios[]` match the probability maths. Note the
  `reason` of an LR item says whether a number refers to the finding present or absent.

## How a number becomes "supported"

1. Claude names up to 3 diagnoses and the patient's findings; a finding is dropped
   unless its `quotedFrom` words are literally in the presentation.
2. Code builds questions (max 12) and search queries from concept words only.
3. Europe PMC title/abstract search (PubMed fallback), top 10 by relevance, ranked
   guideline > review/meta-analysis > RCT > observational > other, newer first; up to
   5 sources per question; open-access full text when available, else the abstract.
   DuckDuckGo Lite finds one guideline page per diagnosis on allowed domains.
4. A checker call (fresh context, passages marked as untrusted) proposes quotes and numbers.
5. Code verifies: the quote is in that source's retrieved text; each number is in the
   quote; the source can support (not paywalled/snippet/placeholder host); no
   instruction-like quotes; one study counts once (PMID/PMCID/DOI aliases).
6. A second, independent Claude call must agree before a number counts as `supported`.

## Limits, retries, failure behaviour

- HTTP: 15 s timeout, 1 retry; 429 waits for `Retry-After` (max 5 s); NCBI requests
  spaced 350 ms apart. Claude: SDK retries 2×, 90 s timeout, server-side fallback on refusals.
- Whole request: 180 s budget; unfinished questions become `insufficient` with a `budget` error.
- 3 consecutive failures of a provider (or of Claude) → stop using it for the request.
  A DuckDuckGo block/challenge stops DuckDuckGo immediately; it is never bypassed.
- Malformed model output → that item is `insufficient` with a `check` error.
- `status`: `complete` (every item answered, no errors), `partial`, or `failed`
  (request rejected, analysis failed, or nothing retrieved).

## Acceptance cases

All tested with fixtures through the interface (`npm test`), no keys or network.

| # | Case | Test | Result |
|---|---|---|---|
| 1 | Supporting passage → supported, traceable | `verify.test` case 1, `gather.test` citations | pass |
| 2 | Related page without the answer → not supported | `verify.test` case 2 | pass |
| 3 | Wrong number / population → not supported, explained | `verify.test` case 3, 3b | pass |
| 4 | Real quote, wrong source → not supported | `verify.test` case 4 | pass |
| 5 | Conflicting sources kept, not averaged | `verify.test` case 5 | pass |
| 6 | Paywalled / abstract-only / snippet labelled; unseen text never supports | `verify.test` case 6–6c, `gather.test` | pass |
| 7 | No results / provider failure → explicit failure | `gather.test` case 7 | pass |
| 8 | Same study twice counts once | `verify.test` case 8, `gather.test` | pass |
| 9 | Placeholder links and injected instructions never trusted | `verify.test` case 9–9b, `gather.test` case 9 | pass |

Privacy tests: identifiers rejected before any call; no patient text in outgoing
requests or in the response (fixture run).

## Live demo (2026-10-17, sore-throat case)

Run against real Europe PMC, PubMed, DuckDuckGo and Claude in about 30 s.
Result `partial`: a supported base rate for group A strep (7.5%, exact quote, Europe PMC
full text, second check agreed). Most likelihood-ratio questions stayed `insufficient`:
the retrieved abstracts did not state the numbers, or the second check judged the quote
ambiguous (e.g. "1.53 versus 1.71" without saying which group is which). That is the
intended behaviour, not a crash. Saved in `examples/sore-throat.response.json`.

What the live runs taught us (fixed): exact-phrase queries returned nothing; full-text
matching returned off-topic papers; PubMed returned 429 under parallel calls;
DuckDuckGo was retried after a block.

## Known limitations

- **DuckDuckGo** has no official API and blocks this kind of traffic after a few
  requests (HTTP 202 challenge). Guideline coverage is therefore unreliable; some
  guideline sites (NICE CKS, CDC) also return 403. The adapter is small
  (`src/retrieve/duckduckgo.ts`) and can be swapped for Tavily.
- Many relevant papers are abstract-only, and abstracts often omit per-sign LRs,
  so coverage of likelihood ratios is thin. Pooled values from meta-analyses usually
  sit in full-text tables that are paywalled.
- The diagnoses come from Claude's medical knowledge; they are search starting points only.
- `patientFindings[].quotedFrom` and `likelihoodRatios[].quotedFrom` are short verbatim
  spans of the presentation (at most ~8 words, e.g. "fever 38.6°C") so findings stay
  traceable. Free text is screened for identifiers first, but these spans do leave the
  module. Remove them if the orchestrator must not see any presentation wording.
- Population/setting phrases must appear in the retrieved source, but not necessarily
  inside the quote.
- Identifier screening is pattern-based; unusual formats can slip through. Real patient
  data needs a DPIA, a legal basis and DPAs with Anthropic (zero retention) first.
- Live behaviour depends on today's search results and model output; tests use fixtures.
