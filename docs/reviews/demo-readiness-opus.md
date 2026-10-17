# Opus demo-readiness reviews

17 October 2026. Claude Opus reviewed the Claude application against the user's
intent: a scripted tour and a genuinely live, clinician-controlled diagnostic
workflow. A second Opus task integrated the team's golden presentations.
Changes are in `675f8f0`; live/browser verification is recorded separately.

## Review findings repaired

- A proposed working diagnosis exposed a Continue button that the server correctly
  rejected until another finding was supplied. The finding form now remains
  available at open stages so the clinician can reconsider, with gates preserved.
- Retrieval/coding failures were hard to find. Each round now records and shows
  actual retrieval counts, passage-check status, limitations and attached codes.
- Home cards now distinguish scripted/no-inference examples from genuine live
  cases. The short live preset includes clearly synthetic, fill-only results.
- The guided gate previously offered several outcomes that all advanced to one
  canned result. It now exposes the one scripted outcome honestly.
- A nonexistent DOI was replaced with the AHA Jones-criteria reference; diagnosis
  evidence is labelled accordingly. Unretrieved treatment-site placeholders no
  longer link to example.org while naming real institutions.
- A contradictory anaemia scenario blurb was corrected to match its presentation.

The parent also extended the existing bounded DuckDuckGo/direct-page fallback
from official coding sources to the configured medical evidence allowlist.
Redirects remain checked; unsupported binary pages and bot challenges are not
treated as source evidence. Fixture tests cover these boundaries.

## Golden presentations

Breathlessness (Kiel), chest pain (Leipzig) and dysuria (Munich) import their
original request JSON presentations unchanged. Breathlessness is prominent on
the home page. Recorded evidence responses, expected diagnoses and study base
rates are not inputs to the live workflow. Additional result-sheet entries are
explicitly synthetic and separate from the original presentation.

Five fixture tests check exact mappings, prominence/mode, absence of expected
answer leakage and result-sheet separation. Combined application checks passed
85 tests, type checks and production build before independent live verification.

This review establishes demo behavior, not clinical validity. Patient diagnostic
percentages remain unavailable. The standalone Person 1 module remains separate,
and medical coding continues through the temporary, limited ICD-10-GM adapter.
