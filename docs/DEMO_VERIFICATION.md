# Independent demo verification — 17 October 2026

Verifier: GPT-6.1-Sol, medium. Product baseline: `675f8f0`, with concurrent hypothesis-detail tabs subsequently committed as `dd54b4d`. Actual synthetic cases, live Anthropic/Tavily configuration; no mocked inference or retrieval. No source changes or service restarts were made by this verifier.

## Results

| Check | Result | Observed evidence |
| --- | --- | --- |
| Guided tour | PASS | Clicked all seven steps forward and six backward; inspected List, Tree and a selected Lyme node; the single scripted result advanced the gate; final working diagnosis and treatment rendered. Synthetic percentages and placeholder sites were labelled. |
| Tour makes no inference calls | PASS | Browser request log contained only health/case-list GETs throughout the tour. “Run this case for real” then created `case_yt7ilvdb` with POST 201, at round zero. |
| Sore-throat live preset | PASS through round two | UI created `case_9zvg5wrw`; round one took 66.259 seconds and round two 66.811 seconds, measured by browser resource timing. |
| Actual clinician gate | PASS | Round one proposed GAS RADT with backup culture if negative. Clicking the matching positive synthetic RADT result-sheet item filled the input and generated **zero API mutations**. Manually selected supports and submitted “Add result & advance”; finding and advance requests both returned 200. |
| Evidence and coding status | PASS, partial evidence | Strep round one reported five source records/five passage-checked findings, deduplicated to two source URLs (CDC and PubMed). Round two reported four/four and proposed GAS pharyngitis. Coding attached zero codes and explicitly said suspected diagnoses were not confirmed codes. |
| Reconsider proposed diagnosis | PASS for clearing proposal | At round two, typed a clearly synthetic reassessment and clicked “Add finding only”. API confirmed pending diagnosis cleared, working diagnosis remained null, round stayed two, HITL cleared, and “Advance a round” became available. |
| Golden breathlessness live round | PASS | UI created `case_24cij9a6`, advanced once in 80.039 seconds. The API presentation was byte-equivalent in JSON content to the UTF-8 golden request presentation. Twelve hypotheses included a branched heart-failure parent and three children. |
| Golden evidence/rank/reference UI | PASS with unavailable frequency | Five raw source records/five checked findings deduplicated to BMJ and PubMed URLs. Selected pulmonary embolism in List and opened Reference: rank #7, clinical probability unquantified, no exact catalogue match, no numeric population context supplied. No fabricated frequency or patient percentage. Dangerous alternatives remained; heart-failure description referenced urgent evaluation. |
| Golden preset cards | PASS | Breathlessness, chest-pressure and dysuria cards visibly labelled synthetic golden examples. Source imports use original request presentations, not saved response/summary artifacts. |
| Clinician confirmation and live treatment | PASS, recreated synthetic case | After the parent restored services, UI-created `case_ttttxx29`; restored the synthetic positive RADT using the finding API (not the UI), then clicked the fourth/final live advance in the UI. It took 65.437 seconds and proposed GAS pharyngotonsillitis. Clicked “Confirm proposed working dx” (200), then “Build treatment plan” (200, 8.081 seconds). The UI displayed clinician confirmation, treatment ready, a five-frame timeline and the complete conservative plan. |

## Limits and environment

- Four paid advances completed in total (three original rounds, one recreated strep round), one live treatment request, zero chat requests. No extra model-access probes or duplicate paid requests were made.
- The development processes stopped during the parent-turn interruption, losing the original in-memory cases as documented. The verifier did not restart them; the parent restored services using detached processes. The recreated case `case_ttttxx29` remains available, closed with a treatment plan. The older case IDs in this report are historical, no longer resumable.
- The recreated round retrieved zero sources: returned pages were cookie/reCAPTCHA barriers and DuckDuckGo returned a challenge. The status strip explicitly reported no literature retrieved; the model and treatment plan acknowledged missing citations and deferred specific drugs, doses and durations to clinician/local-guideline review. This verifies graceful failure, not successful retrieval in that final round. The earlier original rounds did retrieve and passage-check CDC/BMJ/PubMed content.
- Retrieval was honestly partial, with visible limitations and abstract-only passages. Quotation checks establish provenance, not medical validity. This is not an assessment of clinical accuracy.
- Population references were available locally, but these model-generated hypothesis names did not exactly match catalogue entries. This run therefore verifies honest unavailability, not a positive frequency conversion display.
- Before the interruption, the only application-console resource error seen was the missing favicon. Afterwards, SSE reconnects reported connection refused because both development servers were down.
- Collaborative preview transport failed repeatedly with `Preview automation click timed out after 15000ms.`, `Preview snapshot failed: Preview automation snapshot timed out after 15000ms.`, and `Preview automation evaluate timed out after 15000ms.` Verification continued using the Playwright CLI skill, own `demo_verify` browser session, tabs 0 (tour/strep) and 1 (golden). Transport failures were not counted as application failures.
- Parent reported 85 offline tests, type checks and builds passing; this verifier did not repeat those concurrent checks.

## Subsequent integration checks

After the live run, the parent preserved the team's newer medical-coding module
integration from `b721957`. The live workflow above exercised the earlier coding
adapter; it does not establish a positive live assignment by the newly merged
module. Its adapter/module checks, type checks and production build passed.
The final working-tree suite passed 90 application/UI tests and 115 coding tests
(three UI tests belong to concurrent attribution work). A Windows CRLF-only
example-fixture comparison was made portable. Services were restarted against
the rebuilt server; API health and the web entry point returned HTTP 200.
The final restart cleared the synthetic verification case from memory.
