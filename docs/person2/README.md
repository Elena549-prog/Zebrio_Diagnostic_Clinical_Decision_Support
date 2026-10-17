# Person 2 — medical coding

Start with [SPEC.md](SPEC.md). It is ready for implementation; no further
design interview is needed for the first version.

**Goal:** clinical excerpts and supplied evidence in; source-checked German
ICD-10-GM 2026 code suggestions, a concise rationale, and original links out.
Use Claude, Tavily primary search, and DuckDuckGo fallback. Timebox the first
working slice to one hour. Person 3 owns orchestration and probability math.

## Prompt to start your coding session

```text
Read docs/person2/SPEC.md and implement Person 2's medical coding module.
Start with the callable interface and a JSON fixture so Person 3 can
integrate immediately. Use Claude, Tavily, and DuckDuckGo fallback as
specified. Make routine implementation decisions without another
grilling session. Run the completion checks, document what was tested
live versus with fixtures, and list remaining limitations. Keep the
first version within the one-hour scope; improve iteratively afterward.
```

Use your own configured environment credentials. Do not put secrets into
messages, source control, fixtures, or results.
