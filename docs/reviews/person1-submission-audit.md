# Person 1 submission audit

17 October 2026. Read-only independent audit of `origin/main` through
`846c54c` (`5a90fbe`, `e552364`, `8d6e92c`, `ea808ff`, `846c54c`). The
submission is the standalone `evidence-gathering-expert/` directory, not a PR
or separate remote branch. These remote commits have not yet been merged
into the local Claude application. No paid medical/model calls were made.

## Actual behavior

`gatherEvidence({presentation}, deps)` calls Claude to suggest up to three
research diagnoses and extract quoted presentation findings. It searches
Europe PMC, falls back to PubMed, and tries DuckDuckGo for guidelines. A
checking call extracts numerical evidence and supporting passages; code checks
source identity, exact quotes and numerical values, access level, and duplicate
studies. Another model call checks each usable item. Results preserve original
links, population/setting, missing context, conflicts, and access level.

This is primarily a numerical-literature research module: prevalence,
likelihood ratios, sensitivity and specificity. `src/verify.ts` does not mark
a generic qualitative claim supported when its requested numerical measure is
absent. It does not calculate disease probabilities.

## Fit and limits

Candidate numerical evidence was explicitly requested in Person 1's original
brief, so that research is within scope. However, the narrower implementation
does not replace all general qualitative evidence/claim validation. Retain the
current general researcher when adding it as a supplemental provider.

Its model-proposed diagnoses are research hints, not automatic additions to the
case tree. Extracted patient findings are quoted candidates, not new clinician
observations. Missing denominator, population mismatch, absent confidence
intervals, and checker disagreement must survive integration. The saved live
example's 7.5% prior comes from children in Botswana, not an approved German
patient prior; it must not enter live calculations.

There is no Tavily adapter. Guideline discovery through DuckDuckGo is described
as unreliable. Its deadline stops waiting but does not cancel ongoing provider
requests. Those are integration gaps, not capabilities to claim as completed.

## Verification and integration boundary

An isolated temporary copy passed all 57 fixture tests and typecheck after
`npm ci --ignore-scripts`. This verifies that submission's tests and types,
not clinical accuracy. Its included live example is partial: one supported
prior and mostly insufficient likelihood-ratio results.

Before connecting it: adapt the current hypothesis IDs and round findings into
the request; map nested evidence/source IDs to stable case citations; preserve
per-item status and second-check disagreement; add Tavily and real cancellation.
Keep numerical eligibility and deterministic calculation with Person 3.

The user is choosing between supplemental numerical-literature research
(recommended) and extending this module to support general qualitative claims
before replacing the temporary worker. No clinical values have been enabled.

Relevant submission files at `846c54c`: `HANDOFF.md`, `src/gather.ts`,
`src/types.ts`, `src/verify.ts`, `src/retrieve/index.ts`, `src/llm.ts`, and
`examples/sore-throat.response.json`, all under `evidence-gathering-expert/`.
