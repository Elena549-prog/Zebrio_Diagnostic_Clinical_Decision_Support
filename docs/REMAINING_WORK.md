# Remaining work and comparison with Corti Arbor

Audited 2026-10-17 against the local reference `corti-dx-arbor`. This is a
source-code comparison, not a clinical equivalence assessment. Configuring a
Corti connector in the original does not establish that it was used
successfully on every case.

## What has carried over

The app retains presentation intake, the retraceable hypothesis tree and list,
rare-diagnosis flags, retained ruled-out branches, clinician-entered findings,
test proposals, explicit working-diagnosis confirmation, source inspection,
history/timeline, chat, treatment views, and the scripted guided tour. The
Express server owns round progression and tree normalization; Claude supplies
reasoning and structured suggestions. There is no remaining requirement for
Corti's Agent API to assemble this application.

The new round pipeline retrieves evidence before reasoning, applies only
source-supported literature claims, merges the tree deterministically, and
asks the coding adapter for verified suggestions. Model convergence remains
a proposal for the clinician. Sources and quotation checks establish
provenance, not clinical truth.

## Capabilities that have narrower replacements

- **Literature and trials:** Tavily-based medical web retrieval replaces the
  configured PubMed, clinical-trials, and web registry connectors. It can find
  relevant public pages, but does not supply equivalent structured database
  coverage, exhaustive search, or guaranteed full-text access. The temporary
  query vocabulary and retrieval limits further restrict coverage.
- **Medical calculations:** no Corti calculator is present. The original
  engine itself requested model-written percentages and normalized sibling
  weights; it did not implement a reviewed Bayesian probability service.
  The new internal Bayes function is synthetic arithmetic only. Live numerical
  probabilities remain unavailable.
- **Test selection:** the app proposes discriminating tests qualitatively.
  Neither the original prompt's request for maximum information gain nor the
  new test rationale establishes an implemented expected-information-gain
  calculation. Quantitative test utility needs applicable test-outcome
  models, decision thresholds, and consequences in addition to a disease
  probability. This is a later numerical feature, not part of the first model.
- **Drug information:** the original configured DrugBank expert has no
  dedicated replacement. General web retrieval must not be described as a
  verified drug-dose, interaction, contraindication, or allergy-check service.
- **Coding:** the current adapter covers a constrained ICD-10-GM 2026 slice,
  not the original registry expert's broader coding systems and guideline
  workflow. Person 2 owns the production of the agreed German coding module.
  A positive live terminal-code assignment remains unverified.
- **Treatment and procedure case-finding:** treatment generation and its view
  remain, but the new planner only uses the existing source pool. It does not
  retrieve fresh management evidence, trial sites, procedure locations, or
  reported outcomes as the original treatment prompt requested. Resolving a
  citation to an existing source is not claim-level treatment validation.
- **Conversational intake:** the original provisioned an interviewing expert,
  but its reviewed HTTP routes did not call that intake agent. The port uses
  structured intake and clinician-entered findings. An autonomous interview
  loop is not a missing working endpoint from the original.

These narrower replacements are acceptable only within a declared demo scope;
they are not evidence of full Corti expert parity. Restoring every connector
is unnecessary for the first narrow demonstration.

## Person 3's remaining slice

1. Select one diagnostic target and applicable population, then freeze one
   published model specification. Check the full equation, predictor meanings,
   units, threshold boundaries, intercept, and validation evidence. The prior
   adult primary-care pneumonia recommendation is a candidate, not an adopted
   model. See the [model readiness research](research/probability-model-readiness.md).
2. Build the deterministic evaluator with a structured input contract. Store
   model/version, source specification, accepted patient-observation IDs,
   transformed inputs, calculation terms, result, and eligibility limitations.
   Missing required predictors and out-of-scope cases return unavailable;
   unknown is not false. Keep literature claims out of patient measurements.
3. Prevent reuse of observations already included in the model. Do not add
   independent likelihood-ratio updates to its output without a justified
   conditional model. A newly retrieved paper is not a new patient result.
4. Integrate Person 1 and Person 2 against fixtures before switching adapters.
   Preserve their unavailable/partial/clarification statuses, source passages,
   rationale, and original links. Do not turn a coding result into confirmation
   of a diagnosis or a probability.
5. Complete one synthetic case through presentation, evidence, coding,
   clinician finding, second round, confirmation, and treatment if treatment
   is in the chosen demo. Verify that unavailable evidence and calculations
   stay visibly unavailable. Record what was and was not exercised.

For a hackathon demo, numerical correctness means reproducing the specified
published calculation on synthetic inputs and honestly describing its scope.
Clinical probability accuracy additionally needs representative outcome data
and evaluation of calibration, discrimination, and clinical usefulness; unit
tests and a successful LLM call do not establish it. See the primary-source
[external-validation guidance](https://www.bmj.com/content/384/bmj-2023-074820).

## Decisions and follow-up outside the numerical formula

Choose the demonstration case and keep unsupported treatment/procedure
capabilities out of its claims. The case store is in memory, as in the
reference; restart recovery needs persistence. Authentication, deployment,
real-patient privacy arrangements, and clinical validation are separate work
if the app moves beyond the local synthetic demonstration.

Current checks and their limits are recorded in [PORT_STATUS.md](PORT_STATUS.md),
[LIVE_VERIFICATION.md](LIVE_VERIFICATION.md), and
[LIVE_FOLLOWUP_VERIFICATION.md](LIVE_FOLLOWUP_VERIFICATION.md). The follow-up
exercised two rounds, an explicit synthetic clinician finding, confirmation,
and treatment generation; this closes execution coverage, not clinical
evaluation. The latest offline suite passes all 60 tests, typecheck, and build.
The application port remains
local and has not been committed or pushed by this work.
