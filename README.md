# Arbor — Claude edition

A retraceable differential-diagnosis demo adapted from `corti-dx-arbor`.
React renders the hypothesis tree, evidence, timeline, history, guided tour,
and clinician workflow. Express owns case state and a bounded sequence of
Claude-powered evidence, reasoning, and coding steps. No Corti account is
required by this application.

## Run locally

Requires Node.js 22.12+ (tested on Node 24) and npm.

```powershell
npm install
npm run dev
```

Open **http://localhost:5175**. The API is **http://localhost:8788/api**.
The Guided tour works without credentials and labels its values synthetic.

If `.env` does not exist, copy `.env.example` to `.env`. Add
`ANTHROPIC_API_KEY` and `TAVILY_API_KEY` there; keep them server-side and out
of source control. An existing local `.env` should be edited, not overwritten.
Restart the server after changing it. The home-page setup notice and
`GET /api/health` show configuration without revealing credentials.

## Models and workflow

Model IDs are configurable per role in `.env`:

- Orchestration: Opus, medium effort by default.
- Search planning: Haiku.
- Evidence validation, coding, chat, and treatment suggestions: Sonnet.

These are starting configurations, not medical-quality benchmarks. Available
models depend on the Anthropic account. Prompts live in application source;
no private Corti registry prompt was imported.

A round retrieves/validates evidence, updates qualitative hypotheses, checks
coding suggestions, and records a snapshot. Clinicians enter actual findings
and explicitly confirm the working diagnosis. Model convergence is a proposal.
Cases are held in memory for this demo and are lost on server restart.

**Live clinical probabilities are unavailable.** Relative ranking/layout
weights are not patient probabilities. A tested illustrative Bayes kernel is
included internally, but a published clinical model must be selected and
reviewed before numerical probabilities are connected.

Published Orphadata population frequencies now inform ordinal reasoning where
eligible exact matches exist. New candidates can receive one additional bounded
ranking pass; subsequent rounds receive existing references up front. The
right-hand diagnosis panel separates model rank from published frequency and
exposes deterministic conversion math, source links and provenance. The audit
records which references actually reached the agent; attachment alone does not
mean a reference was considered. See the [confirmed scope](docs/specs/population-frequency-context.md).

## Reference data and source attribution

We use **Orphadata Science** for source-backed population-rarity context and
keep **RKI German health-reporting data** available locally for population
frequency research. These are separate from patient-specific probabilities.

The pinned Orphadata release is **July 2026**, exported **23 June 2026**.
RKI is pinned to a **23 September 2026** update; its observations extend through
2025. Dataset update dates do not establish the age of individual source studies.

- [Orphadata epidemiology](https://sciences.orphadata.com/epidemiology/): English
  and German bulk files, ORPHA identifiers, prevalence/incidence estimates,
  geography, source references and curation status.
- [RKI German health-reporting dataset](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen):
  selected disease-frequency indicators with population, period, methods and
  uncertainty. RKI values are not automatically used as patient priors.
- Both downloaded datasets are **CC BY 4.0**. See [Orphadata reuse terms](https://www.orphadata.com/faq/)
  and [RKI licence](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/blob/main/LICENSE).

Download/update locally (requires Python 3):

```powershell
npm run data:sync                 # reproduce the recorded release/checksums
npm run data:sync -- --refresh     # deliberately adopt current upstream versions
```

Files live in `data/reference/`. Large downloads/indexes are git-ignored;
[manifest.json](data/reference/manifest.json) records versions, source URLs and
SHA-256 hashes. [Reference-data documentation](data/reference/README.md) covers
attribution, matching rules, limitations and update behavior. Missing downloads
produce an honest unavailable state. The API exposes `/api/reference-data` and
`/api/reference-data/rarity?name=Cystic%20fibrosis` without paid model calls.

The [local-data math assessment](docs/research/local-data-math-feasibility.md)
checks actual downloaded records. Population unit conversions and rarity bounds
are possible now; patient diagnostic probabilities need applicable test
likelihoods or a validated clinical prediction model.

Attribution: **Orphadata Science: Free access data from Orphanet. © INSERM 1999**,
version in the manifest; and **Robert Koch-Institut, Gesundheitsberichterstattung
– Daten zu nichtübertragbaren Erkrankungen**, Git version in the manifest.
Arbor converts the sources to local indexes and derives displays. Generated
outputs may not accurately reflect the source data; Orphanet/Orphadata is not
responsible for those outputs. Neither institution endorses this application.

## Team integrations

- [Person 1: evidence and validation](docs/person1/README.md)
- [Person 2: medical coding](docs/person2/README.md)
- Person 3: orchestration, deterministic numerical engine, application integration.

[Temporary expert adapters](docs/TEMPORARY_EXPERTS.md) provide source-backed
Tavily/Claude research and official German ICD-10-GM lookup while the team
modules are built. Their exported functions can be replaced without changing
the UI or case workflow. Model-assisted passage checks are not independent
clinical validation. Coding has a bounded DuckDuckGo/direct-page fallback;
blocked or missing evidence is reported rather than invented.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The live smoke script is opt-in because it uses model/search credits; see
`scripts/smoke-live.ts` and `docs/LIVE_VERIFICATION.md` when available. Automated
tests cover contracts, provenance, case-state invariants, and arithmetic;
they do not establish diagnostic accuracy or clinical calibration.

## Standalone team submission

Person 1's module is preserved in this repository for independent development
and integration review. The running application currently uses the temporary
adapters described above; this merge does not activate the standalone module.

## Data sources (Evidence Gathering Expert)

The evidence expert (`evidence-gathering-expert/`, see its
[HANDOFF.md](evidence-gathering-expert/HANDOFF.md)) only uses free, public sources.
Only Tavily needs an API key (free plan).

| Order | Source | What it reads |
|---|---|---|
| 1 | [Europe PMC](https://europepmc.org) | Full text of open-access papers; otherwise the abstract. Searches title and abstract. |
| 2 | [PubMed](https://pubmed.ncbi.nlm.nih.gov) | Abstracts; used when Europe PMC finds nothing or fails. |
| 3 | Guideline websites via [Tavily](https://tavily.com) (fallback: [DuckDuckGo](https://lite.duckduckgo.com/lite/)) | The guideline page text, limited to nice.org.uk, cdc.gov, who.int, idsociety.org, awmf.org, sst.dk and escmid.org. |

- Each question is searched several ways in Europe PMC: by relevance, by citation
  count (to surface the classic, highly cited studies), by care setting (primary care,
  general practice, emergency department) for base rates, and among systematic reviews
  and clinical prediction rules.
- Preprints (not peer reviewed) are excluded. Case reports are ranked last, because a
  single patient cannot give a base rate or a likelihood ratio.
- Sources are ranked: guideline > systematic review / meta-analysis > RCT >
  observational > other > case report, newer first; up to 8 per question.
- A number only counts when its exact quote is found in the text we retrieved and an
  independent second check agrees. If the study population differs from the patient
  (e.g. all ages, another care setting), the number still counts but carries a written
  warning. Every result links to the page it came from.
- Tavily (free plan, 1,000 credits a month) is used for at most one search per diagnosis
  (max 3 credits per patient) and is capped locally at 900 credits a month
  (`TAVILY_MONTHLY_CREDIT_LIMIT`), so the free plan is never exceeded. Without a key, or
  when the cap is reached, DuckDuckGo is used; it often blocks automated searches, and
  then guidelines are skipped (never bypassed) and papers still work.
- Patient text is never sent to these services: search queries contain medical
  concept words only.
