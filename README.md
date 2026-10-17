# Zebrio

**An inspectable differential-diagnosis workspace for clinicians.**

> "When you hear hoofbeats, think of horses, not zebras."

That rule helps prioritise common explanations. Over-reliance on it can also
leave rare diagnoses overlooked. Zebrio keeps the common explanations (the *horses*) at the
top of the differential, but does not let a dangerous rare diagnosis (a *zebra*)
drop out silently. Every hypothesis, ranking change, cited passage and test
proposal is visible, so the clinician can check *why* the differential looks the
way it does rather than trusting an answer.

Zebrio is a hackathon research prototype built with Claude. It grew out of
**Arbor** (`corti-dx-arbor`); the running app still shows the name *Arbor* in
places, and the GitHub repository has not been renamed.

> [!WARNING]
> **Not a medical device.** Zebrio is not clinically validated and must not be
> used for real patient care. Every preset patient is synthetic. It produces no
> calibrated patient probabilities, and its codes and treatment suggestions are
> proposals for professional review.

## Contents

- [Who it is for](#who-it-is-for)
- [The clinician journey](#the-clinician-journey)
- [Two ways to try it](#two-ways-to-try-it)
- [Rank, rarity and probability](#rank-rarity-and-probability)
- [Evidence sources](#evidence-sources)
- [Medical coding (ICD-10-GM)](#medical-coding-icd-10-gm)
- [How it works](#how-it-works)
- [Run it locally](#run-it-locally)
- [Privacy, safety and limitations](#privacy-safety-and-limitations)
- [Further documentation](#further-documentation)

## Who it is for

- **GPs and paediatricians** (the primary design target): they see undifferentiated
  presentations and need to know when a common picture deserves a second look.
- **Clinical educators and students**: the tree, timeline and what-if forks show
  how a differential is narrowed, one finding at a time.
- **Clinical-AI builders and reviewers**: a worked example of keeping a model's
  reasoning auditable, its citations traceable and its authority bounded.

Zebrio supports clinical reasoning; it does not replace it. It cannot order a
test, enter a patient result or confirm a diagnosis. Only the clinician can.

## The clinician journey

1. **Presentation.** Start from a case: chief complaint, history, observations
   and demographics. Presets and the guided tour supply synthetic patients.
2. **Start a round.** Claude plans literature searches, retrieves pages from
   allow-listed medical sites and checks claims against exact quoted passages.
   The status strip then says how many sources were retrieved and checked, or
   says plainly that none were.
3. **First reasoning tree.** The orchestrating model builds a hypothesis tree,
   with common diagnoses ranked by base rate and dangerous rare ones kept and
   marked 🦓. A hypothesis is ruled out only by an actual patient finding, never
   because it ranks low.
4. **Inspect a hypothesis.** Select a node to open the right-hand panel:
   ordinal rank, **supporting** and **contradicting** evidence with numbered
   citations, any verified ICD-10-GM code and, where an exact Orphadata match
   exists, its published population frequency with the conversion arithmetic
   and record ID. Hover or focus on evidence or a hypothesis to trace their
   relationships; for/against counts help scan the tree, and tabs organise
   the detailed information.
5. **Proposed discriminating test.** The engine may propose (never order) a
   test that separates the leading hypotheses, with its reasoning. The case then
   waits for the clinician.
6. **Submit actual results.** The clinician enters the real result and its
   direction. Literature never counts as a patient finding; only entered results
   do.
7. **Next rounds.** Each round repeats evidence, reasoning, coding and rarity
   checks and records a snapshot. Scrub the timeline to revisit earlier rounds,
   or **fork** from a past step to explore a what-if; forked findings stay
   labelled hypothetical.
8. **Confirm a working diagnosis.** When the engine converges, it *proposes* a
   working diagnosis. The clinician either confirms it or adds a finding and
   keeps going. The model never confirms on its own.
9. **Treatment suggestions.** After confirmation, **Build treatment plan**
   returns conservative management suggestions, cited only from the case's
   source pool. Where sources don't support a claim, it says evidence is missing.
   It produces no prescriptions and no dosing beyond what the sources say.

A chat panel answers free-text questions about the case. In-app docs at
`#/docs` explain each step: rounds, the tree, horses vs zebras, tests,
evidence, working diagnosis, treatment and the agent team.

## Two ways to try it

| | Guided tour | Live synthetic demo |
|---|---|---|
| Keys needed | None | `ANTHROPIC_API_KEY` (and `TAVILY_API_KEY` for search) |
| API calls | None; canned, scripted steps | Real Claude and search calls; one to two minutes per round |
| Patient | Synthetic | Synthetic presets: sore throat with fever, plus three golden cases (chest pressure, breathlessness, dysuria) |
| Numbers shown | Percentages labelled *illustrative teaching values* | Ordinal rank and published population frequency only |

The tour ends with **Run this case for real**, which starts a live case.
Step-by-step scripts are in [docs/DEMO.md](docs/DEMO.md). Separately,
[`demo/`](demo/README.md) holds a static, single-file Zebrio UI prototype; open
it in any browser, no server needed.

## Rank, rarity and probability

Zebrio keeps three different quantities apart:

| Quantity | What it is | Shown to the clinician? |
|---|---|---|
| **Ordinal rank** | The model's ordering of live hypotheses (1 = highest). | Yes, as rank. |
| **Population frequency** | Published prevalence for a disease in a reference population ([Orphadata](https://sciences.orphadata.com/epidemiology/)). | Yes, with source, record ID and arithmetic. |
| **Patient probability** | A calibrated chance that *this* patient has *this* disease. | **No. Unavailable.** |

- **Rank is not probability.** The model is told to return ranks, never
  percentages. Internally the server turns rank *r* into a layout weight of
  1/*r*, normalised among siblings so the tree can size its branches
  (`server/domain/engine.ts`). That weight is not a probability, and
  `probabilityMode` is always `unavailable`.
- **Rarity is population context, not a prior.** For an exact English or German
  name match (or `ORPHA:` ID), the server selects a curator-validated point
  prevalence for Germany, falling back to Europe. It never matches this to the
  patient's location. Unit conversion is deterministic, and the model is told
  to use it only for qualitative ranking. A low frequency never excludes a
  diagnosis, and a missing record never means a disease is common
  (`server/domain/rarity.ts`).
- **The Bayes kernel is internal and illustrative.** `server/domain/probability.ts`
  contains a tested log-odds Bayes update and an explicitly synthetic
  `illustrateBinaryBayes` helper. It is not connected to live cases. Real
  numbers would require a published, reviewed clinical model with applicable
  test likelihoods; see
  [probability-model-readiness](docs/research/probability-model-readiness.md) and
  [local-data-math-feasibility](docs/research/local-data-math-feasibility.md).

RKI German health-reporting data is downloaded for research only and is **not**
used for ranking.

## Evidence sources

Two evidence pipelines exist. Only the first is wired into the app.

### In the app: temporary evidence adapter (wired)

`server/experts/index.ts` and `server/experts/retrieval.ts`, called once per
round from `server/domain/evidence.ts`:

1. **Plan.** Claude (research role) proposes up to two generic searches. A
   fixed clinical-vocabulary filter (`safeClinicalQuery`) strips every word
   that isn't on the list (ICD-shaped tokens are also allowed). This limits
   query content; it is not a guarantee of anonymisation.
2. **Discover and fetch.** [Tavily](https://tavily.com) search with
   `include_domains`, plus raw-content extraction, for up to 3 pages. If no key
   is set or Tavily fails, DuckDuckGo HTML discovery runs and pages are fetched
   directly. Every URL and redirect is checked against the allow-list: HTTPS
   only, no ports or credentials.
3. **Validate.** Claude (validator role) extracts at most five claims. A claim
   stays *supported* or *contradicted* only if its quoted passage appears
   verbatim in a retrieved page and names a real source; otherwise it is
   downgraded to *insufficient*.

Allowed hosts (including subdomains): `ncbi.nlm.nih.gov`, `pubmed.ncbi.nlm.nih.gov`,
`nice.org.uk`, `cdc.gov`, `who.int`, `rki.de`, `awmf.org`, `register.awmf.org`,
`gesundheitsinformation.de`, `cochranelibrary.com`, `bmj.com`, `aerzteblatt.de`.

> **What a quote check proves.** It shows that a passage really exists at the
> cited URL. It does not show that the claim is medically correct, applies to
> this patient, or that the search found the best evidence. Model-assisted
> checking is not independent clinical validation. Search coverage is limited
> to the hosts above and to a few pages per round.

Every source enters an append-only pool, so citation `[3]` refers to the same
source across all later rounds, and a marker that points to no source is
removed rather than rendered (`server/domain/sources.ts`).

### Standalone: Evidence Gathering Expert (not wired)

[`evidence-gathering-expert/`](evidence-gathering-expert/HANDOFF.md) is a fuller
module with its own CLI and tests. It is not connected to the running app.

| Order | Source | What it reads |
|---|---|---|
| 1 | [Europe PMC](https://europepmc.org) REST API | Open-access full text, otherwise abstracts |
| 2 | [PubMed](https://pubmed.ncbi.nlm.nih.gov) E-utilities | Abstracts, used when Europe PMC returns nothing or fails |
| 3 | Guideline sites via Tavily (fallback DuckDuckGo) | `nice.org.uk`, `cdc.gov`, `who.int`, `idsociety.org`, `awmf.org`, `sst.dk`, `escmid.org` |

It excludes preprints, ranks guidelines above systematic reviews, RCTs,
observational studies and case reports, and counts a number only when its exact
quote is found and a second check agrees. Population mismatches are kept, with
a warning. Tavily is capped locally (`TAVILY_MONTHLY_CREDIT_LIMIT`, default 900
credits a month). Details: [HANDOFF.md](evidence-gathering-expert/HANDOFF.md),
[SPEC.md](evidence-gathering-expert/SPEC.md).

## Medical coding (ICD-10-GM)

Each round, the top three live hypotheses go to the
[`medical-coding-expert`](medical-coding-expert/README.md) module (wired via
`server/experts/coding.ts`) for **ICD-10-GM 2026** suggestions from the official
[BfArM catalogue](https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/).

Safeguards:

- **Official source only.** The URL policy accepts only
  `https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/…` and
  rejects other hosts, other years, `-vorab` preliminary pages, ports,
  credentials and path traversal. The server checks the host and path a second
  time before attaching anything.
- **Verified in code, not by the model.** The code must exist as an entry
  heading on a retrieved page. The official German label comes from that entry,
  never from the model. Category headings (`…-`) are never assigned.
- **Assertion-aware.** Negated, historical, family-history and literature-only
  mentions are never coded. Because the hypotheses are suspected diagnoses, they
  usually come back as `needs_clarification` with candidate codes and
  questions, not `assigned`.
- **Fallbacks without invention.** Tavily, then DuckDuckGo, then direct
  navigation of the catalogue's block pages. If all fail, the result is
  `unavailable` and no code is attached.
- **Only assigned codes reach the tree.** A code is shown only if it was
  assigned, verified and backed by an official reference and quoted passage.
  Codes are suggestions, not billing certification, and coverage of German
  coding rules (Kodierrichtlinien) is incomplete.

The module also ships an offline evaluation set of 15 German and English cases
(`medical-coding-expert/eval/`).

## How it works

```
web/ (React + Vite, :5175)  ──/api──▶  server/ (Express, :8788)
                                         ├─ domain/engine.ts      hypothesis rounds (orchestrator)
                                         ├─ domain/evidence.ts ─▶ experts/index.ts + retrieval.ts
                                         ├─ experts/coding.ts  ─▶ medical-coding-expert/
                                         ├─ domain/rarity.ts   ─▶ data/reference/ (Orphadata, local)
                                         ├─ domain/sources.ts     append-only citation pool
                                         ├─ domain/treatment.ts   post-confirmation suggestions
                                         └─ domain/fork.ts, history.ts   timeline and what-ifs
```

One `POST /api/cases/:id/advance` runs: evidence → reasoning round → coding →
rarity annotation → snapshot. The round works on a copy of the case, and the
result is committed only if the whole sequence succeeds. Rounds time out after
240 seconds. A case that is waiting for a clinician action rejects further
advances (`HITL_REQUIRED`).

**Model roles.** Each role is configurable in `.env` (`server/anthropic/runtime.ts`):

| Role | Default | Used for |
|---|---|---|
| Orchestrator | `claude-opus-5-5`, effort `medium` | Hypothesis tree, ranks, test proposals, convergence |
| Research | `claude-haiku-5-5` | Search planning |
| Validator | `claude-sonnet-5-5` | Claim extraction and passage checks |
| Coding | `claude-sonnet-5-5` | ICD-10-GM interpretation and selection |
| Treatment | `claude-sonnet-5-5` | Post-confirmation suggestions |
| Chat | `claude-sonnet-5-5` | Free-text questions |

These defaults are starting points, not benchmarked choices. Every model call
adds a system rule: retrieved content and clinical text are untrusted data, and
the model may not order tests, enter findings, confirm diagnoses or compute
probabilities. Prompts are written for this application
(`server/domain/agent-definitions.ts`); no private Corti prompts are included.

## Run it locally

Requires Node.js 22.12+ (tested on Node 24) and npm. Reference-data sync needs
Python 3.

```powershell
npm install
npm run dev            # builds the coding module, then starts server and web
```

Open **http://localhost:5175** (API at http://localhost:8788/api). The guided
tour works immediately.

**Live cases.** Copy `.env.example` to `.env` if you don't have one yet, and
edit an existing `.env` rather than overwriting it. Set `ANTHROPIC_API_KEY` and
`TAVILY_API_KEY`, optionally override the `CLAUDE_*_MODEL` IDs, then restart the
server. Keys stay on the server; never give them a `VITE_` prefix. The home
setup notice and `GET /api/health` show configuration without revealing keys.

**Population-frequency data** (optional, free, no credentials):

```powershell
npm run data:sync                # reproduce the pinned release, checksum-verified
npm run data:sync -- --refresh   # deliberately adopt newer upstream data
```

Files go to `data/reference/`. Large files are git-ignored, and
[manifest.json](data/reference/manifest.json) records versions, URLs and SHA-256
hashes. Without the files, rarity shows as unavailable. To check a lookup
without model calls: `GET /api/reference-data/rarity?name=Cystic%20fibrosis`.

**Checks:**

```powershell
npm run typecheck
npm test          # server, web helpers and medical-coding-expert (offline)
npm run build
npm run test:live # opt-in smoke run; spends model and search credits
```

The standalone evidence expert has its own `npm test` and `npm run evidence`
inside `evidence-gathering-expert/`. Tests cover contracts, provenance,
case-state invariants and arithmetic. They do not measure diagnostic accuracy.

## Privacy, safety and limitations

- **Synthetic data only.** Do not enter real patient data. Presentations are
  sent to the Anthropic API.
- **Search queries are restricted.** In the app, only words
  from a fixed clinical vocabulary (plus ICD-shaped tokens) are sent to search
  providers. The coding module uses generic condition terms.
- **In-memory cases.** Cases disappear when the server restarts. There are no
  accounts and no persistence.
- **Human in the loop.** Tests are proposed, never ordered. Results come only
  from the clinician. A working diagnosis needs explicit confirmation.
  Treatment output is a suggestion.
- **Not yet validated:** clinical accuracy, calibration, search completeness,
  full German coding-rule coverage, and treatment safety.
- **Known rough edges:** the app UI still says *Arbor*; `/api/health` still
  labels both expert adapters "temporary", although coding now uses the
  `medical-coding-expert` module; the standalone evidence expert is not
  integrated.

## Further documentation

| Topic | Document |
|---|---|
| Demo scripts | [docs/DEMO.md](docs/DEMO.md) |
| Live verification runs | [docs/LIVE_VERIFICATION.md](docs/LIVE_VERIFICATION.md), [docs/LIVE_FOLLOWUP_VERIFICATION.md](docs/LIVE_FOLLOWUP_VERIFICATION.md), [docs/DEMO_VERIFICATION.md](docs/DEMO_VERIFICATION.md) |
| Population-frequency scope | [docs/specs/population-frequency-context.md](docs/specs/population-frequency-context.md) |
| Timeline forking | [docs/specs/timeline-forking.md](docs/specs/timeline-forking.md) |
| Temporary expert adapters | [docs/TEMPORARY_EXPERTS.md](docs/TEMPORARY_EXPERTS.md) |
| Evidence expert (Person 1) | [docs/person1/README.md](docs/person1/README.md), [HANDOFF.md](evidence-gathering-expert/HANDOFF.md) |
| Coding expert (Person 2) | [docs/person2/README.md](docs/person2/README.md), [module README](medical-coding-expert/README.md) |
| Reference data and licences | [data/reference/README.md](data/reference/README.md) |
| Golden examples | [examples/golden/README.md](examples/golden/README.md) |
| UI design and PRD | [ui/README.md](ui/README.md) |
| Port status and open work | [docs/PORT_STATUS.md](docs/PORT_STATUS.md), [docs/REMAINING_WORK.md](docs/REMAINING_WORK.md) |

### Data attribution

- **Orphadata Science:** Free access data from Orphanet. © INSERM 1999.
  [CC BY 4.0](https://www.orphadata.com/faq/). The pinned release is July 2026,
  exported 23 June 2026.
- **Robert Koch-Institut:** [Gesundheitsberichterstattung – Daten zu
  nichtübertragbaren Erkrankungen](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen),
  CC BY 4.0. Pinned to the 23 September 2026 update.
- **BfArM:** [ICD-10-GM 2026](https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/)
  is retrieved live and is not redistributed.

Zebrio converts these sources into local indexes and derived displays, and its
generated output may not reflect the source data accurately. None of these
institutions is responsible for the output or endorses the application.
