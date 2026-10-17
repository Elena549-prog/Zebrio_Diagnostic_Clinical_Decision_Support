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
