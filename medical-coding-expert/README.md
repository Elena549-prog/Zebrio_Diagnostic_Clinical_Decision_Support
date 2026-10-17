# medical-coding-expert (Person 2)

Clinical excerpts and evidence in; source-checked **ICD-10-GM 2026** code
suggestions out, each with an official German label, a short rationale, input
references and a link to the BfArM catalogue entry. Spec:
[docs/person2/SPEC.md](../docs/person2/SPEC.md).

## Setup

```bash
cd medical-coding-expert
npm install
cp .env.example .env   # then add ANTHROPIC_API_KEY and TAVILY_API_KEY
```

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Claude (interpretation + code selection) |
| `TAVILY_API_KEY` | – | Primary catalogue search/extract |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Model id |
| `CLAUDE_EFFORT` | `medium` | `low` / `medium` / `high` / `xhigh` / `max` |

`.env` is git-ignored. Keys are never written to results, logs or fixtures.

## Run

```bash
npm run code                                        # examples/request.json
npm run code -- examples/request-underspecified.json
npm run smoke                                       # live check: normal chain + forced DuckDuckGo fallback
npm test                                            # offline fixture tests
npm run typecheck
```

## Use from the orchestrator (Person 3)

```ts
import { assignMedicalCodes } from "../medical-coding-expert/src/index.ts";

const response = await assignMedicalCodes(request, { signal });
```

- Request/response types: [src/types.ts](src/types.ts).
- Sample request: [examples/request.json](examples/request.json).
- Sample response: [examples/response.json](examples/response.json). It is generated offline from a real BfArM page and kept in sync by a test, so you can integrate against it without keys.
- Dependencies (model, search providers, fetcher, clock, limits) can be injected with `options.deps` for tests.

Result `status`:

| Status | Meaning |
|---|---|
| `assigned` | A complete code whose code **and** label were found together in one retrieved official 2026 entry. A coding suggestion only, not a confirmed diagnosis or billing certification. |
| `needs_clarification` | The documentation supports only a heading (e.g. `J45.9-` needs a 5th digit), or the condition is only suspected. `candidates` and `clarificationQuestions` say what is missing. |
| `no_supported_code` | Negated, family history, literature-only, historical, or no fitting official entry. |
| `unavailable` | Claude or both search providers failed. No code is invented. |

Each result also carries `assertion`: `documented`, `suspected`, `negated`, `historical`, `family_history` or `literature_only`.

## How it works

1. **Interpret** (Claude call 1). Lists the conditions and how each is mentioned, plus generic German search terms. No patient text goes into web queries.
2. **Settle non-codable mentions** in code: negated, family history, literature-only and historical never reach retrieval.
3. **Discover pages**. Tavily Search is restricted to `klassifikationen.bfarm.de`, with generated answers off and one retry on transient errors. On failure, or when no usable page comes back, DuckDuckGo HTML search takes over. Credits exhausted (432/433), a bad key or a missing key switch Tavily off for the rest of the process.
4. **Retrieve pages**. Tavily Extract is tried first; if it fails or the text can't be parsed, the page is fetched directly over HTTPS, with every redirect checked.
5. **Select** (Claude call 2). Claude chooses only among the parsed official entries.
6. **Verify in code**. The code must exist as an entry on a retrieved page. The label is taken from that entry, never from the model. A heading (`…-`) is never assigned.

URL policy ([src/urlPolicy.ts](src/urlPolicy.ts)) only accepts
`https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/…`. It rejects other hosts, other years, `-vorab` preliminary pages, ports, credentials and path traversal.

Search engines mostly index the preliminary (`htmlgm2026-vorab`) and older
editions. When a search returns only those, the file name (e.g.
`block-j40-j47.htm`) is used to locate the same page in the final 2026
catalogue. That official page is fetched directly and verified; the other
edition is never fetched or cited. This is noted in `limitations`.

Claude runs with `output_config.effort` (default `medium`), structured outputs,
and the server-side refusal fallback (`fallbacks: "default"`). If a request is
declined, Anthropic re-runs it on a suitable fallback model in the same call,
and the response notes it in `limitations`. If it is still refused, the
affected results are `unavailable`.

Limits per request (in [src/config.ts](src/config.ts), all overridable): 2 searches per provider, 3 pages, 4 Claude calls (2 are used), and a 20 s HTTP timeout.

## Verification record (2026-10-17)

**Offline fixture tests** (`npm test`, 49 tests). Cover:
- URL policy: off-domain, wrong year, preliminary, traversal.
- Parsing of the real BfArM J40–J47 page.
- J46 assigned with its official label, link and passage.
- A wrong code (J96.0, not on the retrieved page) rejected.
- Underspecified asthma returned as `needs_clarification` with the J45.9- category.
- Negated, family-history and literature-only mentions never assigned.
- A suspected condition never assigned.
- Tavily retry, then the DuckDuckGo fallback.
- Credits exhausted switching Tavily off for the process.
- Both providers failing, giving `unavailable`.
- Claude unavailable.
- A refusal-fallback note.
- The example response staying in sync.

**Live** (`npm run smoke` and the CLI, real keys):
- Normal chain: Tavily Search found the page, Tavily Extract read it, and J46 "Status asthmaticus" was verified and assigned. Pneumonia (negated), the mother's diabetes (family history) and pneumothorax (literature only) were correctly not coded.
- Tavily forced off: DuckDuckGo returned only `htmlgm2026-vorab` and 2021 pages. They were rejected as sources, the final 2026 page was located and fetched directly, and J46 was verified and assigned.
- Underspecified asthma (`examples/request-underspecified.json`): `needs_clarification` with candidates J45.9-/J45.0-/J45.1-/J45.8- and questions about control status and severity.
- Two Claude calls failed transiently (one connection error, one timeout) and succeeded on rerun. They returned `unavailable`, as designed.

**Not verified live:**
- Tavily credits actually running out (432/433), which is covered by fixtures only.
- The refusal fallback actually triggering.
- Accuracy across the whole catalogue: these examples don't establish it.

## Known limitations

- Codes built from a 5th-digit modifier (J45.x, E10–E14 and others) are not assembled; they come back as `needs_clarification` with the heading as a candidate.
- German coding rules (DKR), sequencing, and secondary-diagnosis or "V/G/A/Z" certainty markers are not applied.
- Historical conditions (Z86/Z87) and family history (Z80–Z84) are not coded.
- DuckDuckGo HTML is not an official API. Challenge pages are treated as `blocked`, and the engine's index mostly holds non-final editions.
- Search is per request (at most 2 queries per provider), so a request with many conditions searches only the first two distinct ones.
