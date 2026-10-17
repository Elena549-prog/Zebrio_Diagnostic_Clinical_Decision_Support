# Evidence Gathering Expert — agreed design

Spec for `/implement`. Brief and acceptance cases: [docs/person1/README.md](../docs/person1/README.md).
All code for this expert lives in this folder (`evidence-gathering-expert/`).
Everything here was agreed in the grilling session on 2026-10-17.

## Goal

Given a detailed patient presentation, find real medical papers, extract the
numbers Person 3's probability calculation needs (base rates and likelihood
ratios), and prove each one with a URL and an exact quote from retrieved text.
Claude never supplies a number or a URL; only retrieved papers do.

## Constraints

- Built from scratch today in TypeScript (Node 24). No code copied from Arbor;
  only ideas (dedupe by PMID/PMCID/DOI, stable source ids).
- Plain `@anthropic-ai/sdk` calls and `fetch`. No agent framework.
- Model: `claude-sonnet-5-5`, overridable via `EVIDENCE_MODEL`.
- Key in `.env.local` (git-ignored): `ANTHROPIC_API_KEY` only.
  Europe PMC, PubMed and DuckDuckGo need no key. `.env.example` lists the names only.
- We deliver evidence and candidate numbers. We never compute or approve a
  probability; that is the calculator's job.

## Pipeline

```
presentation
 1. ANALYSE    Claude: top 3 diagnoses + the patient's findings.
               Each finding carries `quotedFrom`, a span of the presentation;
               code rejects any finding whose span is not in the presentation.
 2. QUESTIONS  Code builds questions, never answers. Per diagnosis:
               1 base-rate question + up to 3 finding questions (max 12 total).
 3. RETRIEVE   Per question, search in tiers, keep max 5 sources, rank by quality:
                 a. Europe PMC, open access, reviews/meta-analyses/RCTs → full text
                 b. PubMed / Europe PMC, not open access              → abstract
                 c. DuckDuckGo HTML search, site: guideline domains   → page text
               Code stores every source: id, url, title, text, retrievedAt,
               accessLevel, studyType, year. Full texts are cut into sections;
               only sections mentioning the question's key terms go forward.
 4. CHECK      Separate Claude call per question, fresh context. Sees the
               question + numbered passages wrapped as untrusted data. Returns
               verdict, sourceId, exact quote, extracted numbers, reason,
               limitations. It cannot see step 1's reasoning.
 4b. DOUBLE-CHECK  Second Claude call per `supported` item, fresh context.
               Sees only: question + quote + extracted numbers + source info
               (title, studyType, population). Must independently agree that
               the quote answers this exact question (population, number,
               unit, qualifier). Disagreement → not `supported`, reason kept.
               Model agreement is necessary, never sufficient: step 5 still runs.
 5. VERIFY     Code, not the model:
               - quote must occur in that source's stored text (normalised
                 whitespace/case/dashes), else downgrade to `insufficient`
               - every extracted number must appear in the quote, else drop it
               - sourceId must exist in the store; url comes from the store
               - placeholder hosts (example.org/.com, localhost) are never trusted
               - abstract-only sources may support only what the abstract says;
                 `paywalled` / `inaccessible` sources can never support
               - the same study (PMID/PMCID/DOI) counts once, never as
                 independent corroboration
```

Questions run in parallel (concurrency 4).

## Source quality ranking

guideline > systematic review / meta-analysis > RCT > observational > other;
newer before older within a rank. `studyType` is in the output.

Guideline domains for DuckDuckGo `site:` queries: nice.org.uk, cdc.gov, who.int, idsociety.org,
awmf.org, sst.dk, escmid.org.

DuckDuckGo rules: use the HTML/Lite search page (no key, no official API).
Decode its redirect links locally; fetch only final HTTPS URLs on the allowed
domains above, validating every redirect. Search snippets only locate pages; we
fetch and read the page itself. A block, CAPTCHA or challenge is recorded as
`unavailable` and never bypassed; papers from Europe PMC/PubMed still run.
Keep the adapter small and replaceable (e.g. by Tavily later).

## Interface

### Request

```json
{
  "requestId": "optional-caller-id",
  "presentation": {
    "chiefComplaint": "Sore throat and fever for 2 days",
    "history": "Pain on swallowing, fever 38.6°C, no cough, no runny nose...",
    "observations": ["T 38.6°C, HR 88, BP 118/76", "Exudate on tonsils, tender enlarged anterior cervical lymph nodes, no rash"],
    "demographics": { "ageYears": 9, "sex": "female", "location": "Aarhus, Denmark" }
  }
}
```

### Response (grouped per diagnosis, calculator-ready)

```json
{
  "requestId": "...",
  "status": "complete | partial | failed",
  "generatedAt": "ISO time",
  "diagnoses": [{
    "id": "h1",
    "diagnosis": "Group A streptococcal pharyngitis",
    "origin": "suggested_by_model",
    "prior": {
      "question": "Prevalence of GAS in children 5–15 with sore throat?",
      "status": "supported | contradicted | conflicting | insufficient | inaccessible",
      "value": null, "ci95": null, "unit": "proportion",
      "population": null, "setting": null, "denominator": null,
      "missing": ["value", "ci95", "..."],
      "evidenceIds": ["e1"]
    },
    "likelihoodRatios": [{
      "finding": "absence of cough",
      "quotedFrom": "no cough",
      "status": "...",
      "lrPositive": null, "lrNegative": null,
      "sensitivity": null, "specificity": null, "ci95": null,
      "population": null, "setting": null, "denominator": null,
      "missing": ["..."],
      "evidenceIds": ["e2"]
    }]
  }],
  "evidence": [{
    "id": "e1", "sourceId": "pmcid:PMC8978297",
    "url": "https://europepmc.org/article/PMC/PMC8978297",
    "passage": "exact quote from retrieved text",
    "doubleCheck": "agreed | disagreed | skipped",
    "reason": "why it answers this exact question",
    "limitations": ["adults only"],
    "stance": "supports | contradicts",
    "kind": "literature"
  }],
  "patientFindings": [{
    "id": "f1", "text": "no cough", "kind": "patient_finding"
  }],
  "sources": [{
    "id": "pmcid:PMC8978297", "url": "https://europepmc.org/article/PMC/PMC8978297",
    "title": "...", "pmid": "34636404", "doi": null,
    "studyType": "meta-analysis", "year": 2022,
    "accessLevel": "full_text | abstract_only | snippet_only | paywalled | inaccessible",
    "retrievedAt": "ISO time"
  }],
  "errors": [{ "step": "retrieve", "question": "...", "message": "one line" }],
  "limitations": ["Prototype; not clinical validation."]
}
```

Rules:
- `null` + listed in `missing` for anything not stated in the quote. No guesses.
- The calculator should only use values whose `status` is `supported`.
- Conflicting sources: status `conflicting`, all evidence kept, disagreement in
  `reason`. Never averaged.
- Identifiers: `sourceId` is `pmcid:…`, `pmid:…`, `doi:…` or `url:…`; a caller
  resolves a citation by `evidence.sourceId` → `sources[]`.
- Clickable citations: every evidence entry and source carries `url`, the real
  internet address of the page where the paper was found and read (Europe PMC,
  PubMed or the guideline site), copied from the retrieval response, never
  written by the model. When a DOI is known, `sources[].doiUrl` is
  `https://doi.org/<doi>`. Tests assert every `url` came from a retrieval
  artifact and that the CLI prints each citation as a link.

## Fit with the other experts

Checked against `docs/person2/` on 2026-10-17. There is no Person 3 doc yet.

- **Ownership:** Person 3 owns orchestration, probability math and app
  integration. Person 2 owns ICD-10-GM medical coding. (The older Person 1
  brief says Person 2 owns the probability module; the newer Person 2 docs
  supersede that.) We deliver evidence and candidate numbers only.
- **Callable function, not just a CLI:** export one async function
  `gatherEvidence(request, deps)` with injected dependencies (Claude client,
  fetch, clock, config), same pattern as Person 2's `assignMedicalCodes`. The
  CLI is a thin wrapper. No framework-specific code in the interface.
- **Fixture first:** within the first 10 minutes, commit
  `examples/sore-throat.response.json` (hand-written, marked as a fixture) so
  Person 3 can integrate while the real pipeline is built.
- **Feeding Person 2:** the orchestrator can pass our output straight into
  `assignMedicalCodes`:
  - `diagnoses[]` → Person 2 `hypotheses` (`id`, `name` = `diagnosis`). They
    are marked `origin: suggested_by_model`: hints, not confirmed diagnoses.
  - `patientFindings[]` → Person 2 `evidence` with `kind: patient_finding`.
  - `evidence[]` → Person 2 `evidence` with `kind: literature`, `text` =
    `passage`, `sourceUrl` = `url`.
  Literature is never presented as a fact about this patient.
- **Shared conventions:** echo `requestId`; read `ANTHROPIC_API_KEY` and
  a configurable model from the environment; search
  queries never contain raw clinical text; retrieved text is data, not
  instructions; on total failure return an explicit failure, never fabricated
  results; record what was tested live vs with fixtures.
- **Open for Person 3:** confirm the request shape (`presentation` object vs
  Person 2's `excerpts[]`) and that `prior` / `likelihoodRatios[]` match what
  the probability math expects.

## Data protection (GDPR)

Health data is special-category data (GDPR Art. 9). This prototype is built so
patient data stays minimal and never leaks to search providers. It is not a
legal compliance assessment; a real deployment needs a DPIA, a legal basis, and
data processing agreements with every provider.

- **Synthetic data only in this prototype.** Demo and tests use Arbor's
  fictional cases. No real patient data until the points above are done.
- **Pseudonymised input only.** The request schema has no fields for name,
  date of birth, address, phone, email or patient/record IDs. Before anything
  else, code scans all free text for direct identifiers (emails, phone
  numbers, ID-like numbers, dates of birth, street addresses). A hit rejects
  the whole request with an error naming the field; nothing is sent anywhere.
- **Minimise before sending to Claude.** Code turns age into an age band
  (e.g. `5–15`) and location into a country before step 1. Claude receives
  only chief complaint, history, observations, sex, age band and country.
- **Search queries never contain patient text.** Queries to Europe PMC,
  PubMed and DuckDuckGo are built by code only from diagnosis names, finding terms
  and the age band, never from the presentation's free text. A test asserts
  that no outgoing query contains any presentation sentence.
- **Claude API.** Anthropic acts as a processor. For any real deployment, use
  an organisation with a DPA and zero data retention; the prototype logs which
  model was called but not the prompt.
- **No storage of patient data.** The presentation is held in memory for the
  request only. Files in `out/` and all logs contain questions, evidence and
  sources, never the presentation. `requestId` is a random UUID, not a patient
  identifier. `out/` and `.env.local` are git-ignored.
- **Errors and logs** use one-line summaries without patient text.

## Failure behaviour and limits

- HTTP calls: 15 s timeout, 1 retry. Claude calls: 2 retries with backoff.
- Whole request: 180 s budget; unfinished questions become `insufficient` with
  an error entry.
- 3 consecutive failures of one provider → stop using it for this request,
  record it in `errors`.
- Malformed model output → that question is `insufficient`, never `supported`.
- `status`: `complete` (all questions answered), `partial` (some
  insufficient/errors), `failed` (nothing retrieved / step 1 failed).

## Commands

- `npm run evidence -- examples/sore-throat.request.json` → prints response JSON
  and writes it to `out/`.
- `npm test` → all tests, no API keys, no network.

## Tests (repeatable, no keys, no network)

Fixtures in `test/fixtures/`: saved source texts + saved checker responses
(replayed through a fake Claude client). One test per acceptance case:

1. Supporting passage → `supported`, URL from store, quote found in text.
2. Related but non-supporting page → not `supported`.
3. Wrong number/unit/population → not `supported`, discrepancy in `reason`.
4. Quote attributed to the wrong source → not `supported`.
5. Two conflicting sources → `conflicting`, both kept.
6. Paywalled / abstract-only labelled correctly; unseen text never supports.
7. No results / provider error → explicit `insufficient`, `partial`/`failed`.
8. Same study found twice (PMID + PMCID) → one source, counted once.
9. `example.org` link and "ignore your instructions" text in a page → never
   trusted, instructions not followed.

Plus privacy tests: a request containing an email, phone number or date of
birth is rejected before any call; outgoing search queries contain no
presentation text; `out/` files contain no presentation text.

Plus unit tests for: finding `quotedFrom` check, quote normalisation, number-
in-quote check, dedupe, ranking.

## Live demo

The quick sore-throat case from Arbor (9-year-old, Aarhus) in
`examples/sore-throat.request.json`. Its response saved as
`examples/sore-throat.response.json`.

## Handoff (evidence-gathering-expert/HANDOFF.md, written at the end)

Setup, env var names, commands, example request/response, integration notes
for the orchestrator and calculator, which acceptance cases pass, known
limitations. Not clinical validation.

## Build order (TDD slices)

0. Interface types, `gatherEvidence` stub and hand-written response fixture for Person 3.
1. Types + VERIFY rules (pure functions) with tests 1–4, 6, 8, 9; privacy
   guard (identifier scan, age band, country) with its tests.
2. Source store + dedupe + ranking.
3. CHECK + DOUBLE-CHECK steps with fake Claude client (tests 3, 5, 9).
4. RETRIEVE: Europe PMC, PubMed, DuckDuckGo adapters (fixture-tested; live smoke).
5. ANALYSE + QUESTIONS.
6. Orchestration, budgets, failure handling (test 7); CLI.
7. Live demo run, save example response, write HANDOFF.md.
