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
npm test                                             # 66 tests, no keys, no network
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
2. Code builds questions (max 12) and search queries from concept words only. Method
   words ("diagnosis", "differential", "accuracy"), negations and a second condition
   after "versus"/"or" are dropped, and diagnosis words the model appended to a finding
   are removed ("NT-proBNP heart failure diagnosis" → "nt-probnp").
3. Europe PMC title/abstract search, each question asked several ways (top 10 each):
   the main query in relevance order and in citation order (`sort=CITED desc` surfaces
   the classic diagnostic studies), plus a base-rate variant by care setting (primary
   care, general practice, emergency department) and a systematic-review variant for
   priors, and a review / prediction-rule variant of the diagnosis for likelihood ratios.
   Results are merged round-robin and deduplicated; PubMed is the fallback when every
   variant is empty. Preprints are excluded (`NOT SRC:PPR`, and in code by publication
   type and preprint-server DOI); case reports go last. Up to 5 sources per question,
   ranked guideline > review/meta-analysis > RCT > observational > other > case report,
   newer first; open-access full text when available, else the abstract (also when the
   full text returns an error). DuckDuckGo Lite finds one guideline page per diagnosis
   on allowed domains.
4. A checker call (fresh context, passages marked as untrusted) proposes quotes and numbers.
5. Code verifies: the quote is in that source's retrieved text; each number is in the
   quote; the source can support (not paywalled/snippet/placeholder host); no
   instruction-like quotes; one study counts once (PMID/PMCID/DOI aliases).
6. A second, independent Claude call must agree before a finding counts, whether it
   supports or contradicts. One study speaks once per question, so it can neither
   corroborate nor contradict itself.

## Limits, retries, failure behaviour

- HTTP: 15 s timeout, 1 retry; 429 waits for `Retry-After` (max 5 s); NCBI requests
  spaced 350 ms apart. Claude: SDK retries 2×, 90 s timeout, server-side fallback on refusals.
- Whole request: 180 s budget; unfinished questions become `insufficient` with a `budget` error.
- 3 consecutive failures of a provider (or of Claude) → stop using it for the request.
  A DuckDuckGo block/challenge stops DuckDuckGo immediately; it is never bypassed.
- Malformed model output → that item is `insufficient` with a `check` error.
- `status`: `complete` (every item answered; `errors` may still list an unavailable
  provider), `partial`, or `failed` (request rejected, analysis failed, or nothing retrieved).

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

## Coverage work (2026-10-17, golden examples)

Changes: clean concept terms (prompt + `conceptTerm`), query variants merged per
question (relevance + citation order, care-setting and review variants), preprints
excluded, case reports last, 8 sources per question (was 5), contradicted items carry
no values. No verification rule was loosened.

Live runs of `examples/golden/*` (supported items / all items; each run 13–32 s):

| Case | Before | After, run A | After, run B |
|---|---|---|---|
| 1 chest pain | 0 / 12 (1 contradicted, values from an unrelated GERD stress-test study) | 0 / 10 | 0 / 12 |
| 2 breathlessness | 1 / 12 (PE: tachycardia sens 0.33) | 1 / 12 (CAP prior 0.35) | 2 / 12 (CAP prior 0.35; ADHF: raised JVP spec 0.70) |
| 3 dysuria | 0 / 12 | 1 / 12 (vaginitis: leukocyte esterase sens 1.0, spec 0.90) | 1 / 12 (same) |
| **Total** | **1 / 36** | **2 / 34** | **3 / 36** |

Preprints in sources: 4 before, 0 after. Results vary between runs (same code gave
0 and then 1 supported item for case 2 at 5 sources per question).

What now limits coverage: retrieval finds the classic studies (e.g. "Chest pain in
primary care: epidemiology and pre-work-up probabilities", Breathing Not Properly's
"47 percent" heart-failure rate in ED dyspnoea), and their quotes pass code
verification, but the independent second check rejects most of them because the
study population does not match the question's age band ("not specifically among
patients aged 65+"). Case 1 had 4 such rejections per run. Whether a wider study
population that includes the patient's age band should count (with a limitation)
is a design decision for the team; it was left unchanged here.

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
  inside the quote. A denominator must contain a count.
- `contradicted` items carry no numbers: values come only from supporting evidence. A
  contradicting study's numbers often answer a different question, so they stay readable
  in its cited passage only. A `conflicting` item takes its values from the supporting study.
- `conflicting` means one source supports and another contradicts. Two supporting
  studies with different values stay `supported` (best-ranked value) and `note` lists
  the other values; read `note` before using a value.
- On a model policy refusal, the API's server-side fallback may answer with a different
  Claude model (`fallbacks: "default"` in `src/llm.ts`). Remove it if every call must
  use `EVIDENCE_MODEL`.
- `src/report.ts` (the CLI's linked summary) and the files written to `out/` are not
  unit-tested; the response object they print is.
- Identifier screening is pattern-based; unusual formats can slip through. Real patient
  data needs a DPIA, a legal basis and DPAs with Anthropic (zero retention) first.
- Live behaviour depends on today's search results and model output; tests use fixtures.

## Population check relaxed (2026-10-17)

The second check used to reject a correct quote whose only problem was a population
different from the patient's (e.g. all ages vs 5–15, primary care vs emergency). That was
the main cause of `insufficient`. Now, when the second check says the quote and numbers are
right and only the population or setting differs (`populationMismatchOnly`), the item is
`supported` and the difference is added to the evidence `limitations` and the item `note`
("Population differs from the patient: ..."). Quote-in-text, number-in-quote and source
rules are unchanged. **The probability step should read `note`/`limitations` before
using such a value.**

Live golden runs after this change: **7 / 34 supported** (chest pain 2, breathlessness 5,
dysuria 0), all with a population warning. Examples: stable angina 6% of ED patients with
suspected cardiac ischaemia; orthopnoea LR 39.1 for heart failure in primary care;
community-acquired pneumonia 35% of acute respiratory failure in elderly patients.
