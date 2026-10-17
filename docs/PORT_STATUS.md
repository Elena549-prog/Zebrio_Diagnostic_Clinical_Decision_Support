# Claude port status

The application has been assembled locally in the team repository. The
original `corti-dx-arbor` application remains the reference; its runtime source
was not replaced. No Corti credentials or active Corti transport are required
by this new app.

## Present and checked

- Reused React application, hypothesis tree/list, timeline/history scrubber,
  guided tour, case intake, evidence inspection, chat, and treatment views.
- Claude runtime in Express, using configurable role models: Haiku research,
  Sonnet validation/coding/chat/treatment, Opus medium orchestration.
- Temporary Tavily-backed research and passage validation plus constrained
  German ICD-10-GM coding, ready for replacement by the teammate modules.
- Current-round evidence grounding, staged round commits, case locks, failed
  round rollback, and explicit clinician confirmation of working diagnosis.
- Local ignored `.env` with authorized credentials; blank `.env.example` for
  sharing. Credentials are not returned by health checks or browser bundles.
- Final typechecks, 60 automated tests, production build, and browser smoke
  checks pass. Dependency audit reported no known vulnerabilities after updates.
- Independent live probes passed for all three configured Claude models.
  A synthetic case completed one real round and a read-only chat; the clinician
  gate blocked a second advance. See [verification](LIVE_VERIFICATION.md).
- A subsequent synthetic live workflow completed two rounds, an explicit
  clinician finding, diagnosis confirmation, and treatment generation. See
  [follow-up verification](LIVE_FOLLOWUP_VERIFICATION.md); treatment claim
  correctness remains unverified.
- Verified coding suggestions now retain the official reference URL and
  rationale on the hypothesis and in history for the existing UI to display.

## Remaining before claiming the full intended behavior

See [REMAINING_WORK.md](REMAINING_WORK.md) for the capability comparison with
original Corti Arbor and Person 3's integration/numerical-engine checklist.

1. **Published probability model:** the user chose to select a published
   clinical model before connecting probabilities. An internal synthetic
   binary Bayes kernel is tested, but live probabilities remain unavailable.
   Choose a target/population/reference standard, obtain complete coefficients
   and preprocessing, review applicability and rights, and evaluate calibration.
   The [new research](research/probability-model-readiness.md) located the
   complete adult primary-care pneumonia equation and external evaluations,
   with an explicit temperature-boundary discrepancy. It remains a candidate,
   not an adopted or implemented clinical model.
2. **Teammate expert integrations:** replace temporary adapters with Person 1's
   evidence/validation module and Person 2's coding module, using recorded
   request/response contracts and fixtures. Existing source and quotation
   checks establish provenance, not medical correctness.
3. **Positive live coding check:** the integrated live smoke safely returned
   no supported codes. Source/code checks pass with fixtures, but an actual
   documented condition -> correctly assigned terminal code still needs a
   positive live integration check. Do not advertise coding accuracy yet.
4. **Treatment grounding:** two-round execution and live treatment generation
   now pass a synthetic follow-up. However, treatment only uses existing
   sources, permits uncited suggestions, and checks citation membership rather
   than independently verifying each management claim. Add management-specific
   retrieval/validation if treatment is part of the promised demo behavior.
5. **Demo scope and persistence:** choose the case for the demonstration.
   Current case state is in memory and is lost on restart. Add persistence
   before requiring restart recovery; auth/deployment and real-patient use
   are not part of this local demo verification.

## Run

`npm run dev` serves the UI at `http://localhost:5175` and API at port 8788.
`npm run typecheck`, `npm test`, and `npm run build` are offline checks.
`npm run test:live` deliberately spends API/search credits.

Changes are local; this port has not been committed or pushed by the agent.
