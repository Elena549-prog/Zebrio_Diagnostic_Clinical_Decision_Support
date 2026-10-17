# Independent verification of the Claude migration

Executed 2026-10-17, starting 11:32:50 UTC, against the local application at `http://127.0.0.1:8788`. Only synthetic clinical material was submitted. Credentials were loaded from the ignored root `.env`; no credentials or provider error bodies are included in this report.

## Results

- **PASS:** `npm run typecheck` for server and web.
- **PASS:** `npm test`, 57 tests, including temporary expert adapters. Tests cover missing-key structured 503 responses without mutation, clinician confirmation, blocked duplicate advances, rollback, concurrent mutation locks, source boundaries, unsupported quotations, coding ambiguity, and DuckDuckGo fallback.
- **PASS:** `npm run build`, producing both web and server builds.
- **PASS:** configured Anthropic model access and JSON response shape. One tiny request per distinct configured model returned the expected object. Each probe used 46 input tokens and 9 output tokens; the returned model IDs matched the requested IDs:
  - `claude-opus-5-5`, orchestrator, `output_config.effort: medium` accepted.
  - `claude-haiku-5-5`, researcher.
  - `claude-sonnet-5-5`, validator, coding, chat, and treatment configuration.
- **PASS:** one real synthetic adult sore-throat round completed through the temporary research/validation/orchestration/coding workflow: seven hypotheses, three retrieved sources, five findings, one round-history frame.
- **PASS:** tree IDs, parent/child relationships, reachability, and lack of cycles; hypotheses retained numerical layout weights with `probabilityMode: unavailable`.
- **PASS:** source URLs passed the configured medical/official-ICD restrictions and carried nonempty supporting excerpts and retrieval timestamps. Finding citation indices resolved to the source pool. These checks establish provenance metadata and citation integrity, not medical correctness.
- **PASS:** the model proposed convergence, but `workingDiagnosis` remained absent. A second advance returned HTTP 409; round and diagnosis state remained unchanged. The agent did not add clinician/lab/exam observations or mark tests ordered/resulted.
- **PASS:** live chat returned text without changing the case snapshot.
- **PASS:** the synthetic case created by this verifier was deleted with HTTP 204. Existing cases were not deleted or modified.
- **PARTIAL:** the coding adapter ran and reported Tavily usage, but all three candidate results were `no_supported_code`; no code was attached. This establishes safe refusal, not successful positive coding assignment. A known documented condition with a verified terminal code still needs a positive live integration check when the teammate's module arrives.
- **NOT RUN:** treatment generation, a second reasoning round, real-patient evaluation, clinical calibration, and diagnostic/coding accuracy benchmarks.

## Findings and limits

The completed paid run found one metadata omission: `applyEvidence` accepted supported claims without copying their `validationStatus` onto stored `Finding` objects. Source objects retained the status, so the saved machine report's `supportedLiteratureFindings` counter is zero despite five accepted literature findings. The parent subsequently fixed this: stored findings and history now preserve status, and missing/insufficient/contradicted claim support cannot be promoted to accepted findings. Two targeted regression tests pass. The final offline suite is **59/59**, with typecheck and production build passing. The saved paid-run JSON remains unchanged; no extra paid run was made after that fix.

The direct probes verify authentication, configured model availability, medium-effort parameter acceptance, and a minimal structured-output instruction. They do not prove that a model reasons correctly about medicine. The application must continue to display live clinical probabilities as unavailable until a justified published model and applicable inputs have been selected and reviewed.

The three tiny probes plus one bounded workflow and one chat use approximately nine model requests under the current adapters. No repeated full-round retries were performed. Model access for the treatment role is covered by its shared Sonnet model probe; the treatment prompt/workflow itself was not exercised.

## Re-run explicitly

Start the server with the project `.env` configured, then run from the repository root:

```powershell
npx tsx scripts/smoke-live.ts --live
```

Without `--live` or `LIVE_SMOKE=1`, the script exits before sending requests. A re-run incurs API/search usage and creates then deletes only its own synthetic case. `SMOKE_API_BASE` can override the local API URL. Do not run concurrent builds that restart the in-memory development server during the smoke test.

The root alias `npm run test:live` explicitly opts in to the same paid checks.

## Parent browser checks

The collaborative browser exercised the guided tour through all seven steps,
tree/list switching, scripted test-result progression, history stepping, and
blank-case intake. The live workspace clearly displayed probability
unavailability; tutorial percentages were labelled illustrative. No browser
console errors were observed. The UI-only synthetic case was deleted, and
generated one-click patient-result shortcuts were removed from live intake.

Sanitized model metadata and observed check counts are in [live-verification-results.json](live-verification-results.json). The script reports incomplete coding as partial; it never turns safe refusal into proof of coding accuracy.
