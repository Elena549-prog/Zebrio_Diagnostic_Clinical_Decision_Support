# Do we need disease percentages?

Later decision, 17 October 2026: the user approved showing published population
frequency alongside ordinal agent ranking, with deterministic unit conversion
and source inspection in the persistent right panel. Patient-specific diagnostic
percentages remain unavailable. See the [confirmed implementation scope](../specs/population-frequency-context.md).

Research and code audit, 17 October 2026. Recommendation for discussion;
no clinical or UI behavior changed.

## Recommendation

**Build the useful evidence-and-options workflow now, without disease
percentages.** Show a model-suggested order, patient evidence supporting and
opposing each option, missing information, clickable source passages, and
suggested questions/tests for clinician review. Keep published calculators
as optional, narrowly applicable additions. This is an engineering judgment,
not a claim that our app has demonstrated clinical benefit.

A ranked differential can be evaluated for usefulness independently of
calibrated disease percentages. The primary AMIE study evaluated diagnostic
lists and clinician assistance on 302 difficult published cases. Its authors
warn that this setting differs from routine practice and call for further
evaluation. It supports exploring this product direction; it does not
validate Arbor or this proposed UI. [Original study](https://www.nature.com/articles/s41586-025-08869-4).

## What our code actually does

- **Original Arbor:** `server/domain/engine.ts` asked the LLM for
  `probability(0-100)`, divided by 100, then normalized sibling weights.
  Its Bayesian wording was an instruction to reason, not a numerical
  probability model with verified inputs. Normalization only makes numbers
  add up; it does not test whether they match outcomes.
- **Current Claude app:** `server/domain/agent-definitions.ts` requests
  ordinal ranks and forbids clinical percentages. `engine.ts` converts ranks
  to weights for ordering/layout. `web/src/probabilityDisplay.ts` labels live
  probabilities unquantified. `RankedDifferential.tsx` still draws proportional
  bars, which could imply quantitative precision despite its tooltip.
- **Zebras in both:** the LLM supplies `isZebra`; the engine directly copies
  it. There is no prevalence lookup, reviewed threshold, or independent rarity
  validation. `baseRateNote` can contain citations but citations alone do not
  establish population applicability. The current rare/dangerous wording also
  conflates rarity and urgency.

## Math is possible; inputs and evaluation are the challenge

Bayes' rule can update prior odds using a test likelihood ratio. Several
updates require an appropriate joint model or justified conditional
likelihoods; multiplying marginal likelihood ratios for related findings can
double-count information. A textbook's sequential-test discussion explicitly
describes this dependence issue. [Diagnostic-test methods](https://www.ncbi.nlm.nih.gov/books/NBK235178/).

There is no defensible universal rule that turns an arbitrary collection of
web claims into patient probabilities. The retrieved evidence must establish
appropriate baseline risk, measurement definitions, test characteristics,
population/setting, and relationships between findings. Ten citations are
not ten independent pieces of evidence. A published regression model is one
way to handle a specified combination; a justified Bayesian model or an
empirically validated machine-learning model are other possibilities.

Deterministic code is useful for correct, replayable arithmetic. It is not
sufficient for accurate clinical probabilities. Evaluation must compare
predictions with observed outcomes in relevant data, including calibration,
discrimination, and usefulness at intended decision points. [Model-validation
methods](https://www.bmj.com/content/384/bmj-2023-074820).

## Can we reuse LLM percentages?

They can be studied as **experimental model estimates**, but should not be
presented as established patient risks in this MVP. A plausible explanation
and citations do not calibrate a percentage. Calibration means checking
whether, across many suitable cases assigned approximately 70%, about 70%
actually have the specified outcome.

Do not claim LLM probabilities are always meaningless. Tian et al. found
that asking models to express confidence improved calibration relative to
token probabilities on particular question-answering benchmarks. That is
confidence in answer correctness, not automatic validation of a patient's
disease risk. [Primary calibration study](https://arxiv.org/abs/2305.14975).
Rodman et al. also directly studied GPT-4's pre-/post-test estimates in five
clinical scenarios; this is a bounded research precedent, not validation of
our Claude model, prompts, retrieval, or patient population. [Original
clinical study](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2812737).

Keep these distinct: source passage supports a claim; model expresses
confidence in its answer; patient has a particular disease. None is a
substitute for the others.

## Proposed qualitative UX

These are design recommendations requiring user agreement:

1. Replace probability placeholders and proportional rank bars with plain
   ordinal order, explicitly model suggested. A high position is not a
   numerical risk or an instruction to act.
2. Show each option's confirmed patient facts, relevant general literature,
   evidence against it, unknowns, and what might distinguish alternatives.
   A paper describing a symptom never supplies that symptom for this patient.
3. Keep **rarity**, **patient fit**, and **consequences of missing a condition**
   separate. An uncommon condition can fit strongly; a common one can be
   dangerous. Use a provisional label such as "Uncommon possibility — model
   suggested" unless a relevant population source supports rarity. Allow
   rarity to be unknown. Do not invent a numerical zebra cutoff.
4. If retrieval finds nothing useful, show "No supporting source verified in
   this search" alongside unverified model suggestions, retrieval limitations,
   and missing information. Do not imply no evidence exists or a disease is
   excluded. If there is insufficient case information even for reasonable
   suggestions, ask for it instead of filling the panel with guesses.
5. Keep clinician confirmation, actual-versus-hypothetical labels, and the
   history trail. Evaluate claim support, source relevance, omitted important
   options, and clinician task performance; hiding numbers alone does not
   establish safety or usefulness.

Person 1's numerical-literature provider can supply candidate evidence for
future calculations; it should not silently convert extracted prevalence or
test accuracy into this patient's prior or posterior.

## Decision frontier for the user

**Q1 — MVP output:** Should live cases show ranked options and explicit
evidence gaps without any disease percentages, with applicable calculators
remaining optional future work? Recommended: yes.

**Q2 — Zebra meaning:** Should we keep a clearly provisional uncommon-option
label, separate from an independently explained clinical-concern flag, and
allow rarity to be unknown? Recommended: yes; do not present the current LLM
boolean as verified epidemiology.

After these decisions, decide the exact appearance and fallback wording.
No implementation or integration changes are authorized by this research
note alone.
