# First published probability model: readiness and next build

Researched 17 October 2026. Research proposal, not an adopted clinical model.
No clinical scoring code or coefficients were enabled by this work.

## Recommendation

**Use one narrow binary diagnostic model as the first numerical feature.**
The best candidate from the existing research is the van Vugt adult
primary-care acute-cough pneumonia model, initially its **six-predictor
signs-and-symptoms logistic variant without CRP**. We found its full equation
in a primary external-validation supplement, so lack of coefficients is no
longer the main blocker. This is a recommendation to review and reproduce
that particular variant, not a claim that it is suitable for German patients.

**Go:** build typed inputs, eligibility checks, a fixed model artifact,
deterministic replay, and reference fixtures behind an experimental gate.
**No-go:** connect patient-facing clinical percentages until the model variant,
predictor definitions, temperature boundary, intended setting, and review
responsibility are agreed. Live probabilities should remain unavailable.

One pneumonia probability is not a probability distribution over every
hypothesis in Arbor. Leave other diagnoses qualitatively ranked; do not
renormalize their ranks or independent binary estimates to sum to 100%.

## What the candidate predicts

The original study recruited adults with acute cough in European primary
care. The external-validation authors' S3 eligibility table describes
immunocompetent adults with cough lasting **less than four weeks** and
suspected lower respiratory tract infection; exclusions include pregnancy,
previous consultation and antibiotics within one month. Verify these
against the original protocol before encoding them. [Primary eligibility
supplement](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0149895.s006&type=supplementary).

The analyzed original cohort comprised 2,820 patients,
140 with radiographic pneumonia. Chest radiographs were obtained within
seven days. This targets pneumonia present around the consultation, as
ascertained radiographically; it does not predict bacterial etiology,
antibiotic benefit, mortality, or future deterioration. The original report
also notes imperfect radiograph agreement and that its simplified points
score performed less well than the original coefficients. The clinical
owner must verify the complete eligibility and measurement definitions
before adopting them. [Original study and methods](https://www.bmj.com/content/346/bmj.f2450),
[accessible author-institution PDF](https://orca.cardiff.ac.uk/id/eprint/48861/1/bmj.f2450.full.pdf).

## Executable equation located, with one important discrepancy

Schierenberg et al.'s **S2 Table, van Vugt '13 row** specifies:

```text
z = -3.984
    + 0.446 * dyspnea
    + 0.698 * absence_of_coryza
    + 0.596 * diminished_breath_sounds
    + 1.404 * crackles
    + 0.961 * (pulse_per_minute > 100)
    + 0.980 * (temperature_C > 37.8)
p = 1 / (1 + exp(-z))
```

Indicators take 1 when present and 0 when explicitly absent. Unknown is not
0. This is the **published external-validation specification**, not a new
fit or an equation reconstructed from rounded odds ratios. Its intercept is
already part of the model; do not add a guessed demographic prior or apply
an extra CRP likelihood ratio. [Primary S2 supplement](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0149895.s005&type=supplementary).

**Boundary to resolve:** the original paper's results prose says temperature
**≥37.8°C**, while its simplified-score footnote and the external-validation
S2 equation say **>37.8°C**. Do not silently choose one and call it the
original model. A reproducibility-only implementation could explicitly
identify itself as the *2016 S2 specification* using `>`, while adoption of
the original clinical model waits for source/code or author clarification.
Original appendix 5 is listed as a nomogram; its PDF was not retrievable in
this run. No additional coefficient precision or coefficient covariance was
verified. [Original paper](https://www.bmj.com/content/346/bmj.f2450),
[S2 supplement](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0149895.s005&type=supplementary).

## What external evaluations establish

The 2016 IPD study included 5,308 patients across eight datasets overall,
but **the van Vugt signs-and-symptoms model was externally evaluated in
699 patients across three datasets**. Its pooled AUC was 0.79
(95% CI 0.74–0.85); grouped calibration was encouraging. Missing predictors
limited which datasets each model could use, some predictor definitions
were substituted, and calibration was not pooled. **CRP was not evaluated
in that study**, so its result cannot validate the CRP extension. Individual
patient data require author access and consent from original-study authors;
the open paper is not an open validation dataset. [Primary 2016 study](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0149895).

A newer evaluation published 20 February 2026 studied 718 US primary/urgent
care adults, including 29 clinically and/or radiographically diagnosed CAP
cases; CRP was available for 575. Table 3 reports AUC 0.71 (0.58–0.84) for
the van Vugt signs-and-symptoms logistic model and 0.81 (0.72–0.89) for its
CRP version. The article also evaluates points scores separately. Not all
patients received imaging, so its outcome differs from systematic
radiographic ascertainment. This adds contemporary evidence; it does not
establish calibration in German primary care or resolve the original
temperature discrepancy. [Primary 2026 study](https://doi.org/10.1080/13814788.2026.2628370),
[open full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC12927402/).

## Person 3: next build slice

These are proposed Arbor engineering decisions, not study findings.

1. **Typed inputs and clinician confirmation.** Capture setting, age,
   cough duration, relevant exclusions, the four symptom/examination
   indicators, measured pulse and temperature, units, observation IDs,
   and measurement time. Claude may suggest extracted fields with excerpts;
   the clinician confirms them. Literature passages cannot become patient
   measurements.
2. **Eligibility and missingness first.** Return `out_of_scope`,
   `missing_input`, or `model_definition_unresolved` with field-level reasons.
   For this first implementation, abstain when a required input is unknown.
   Do not copy research imputation into live use without its complete,
   deployable specification. Published methodological guidance distinguishes
   development-time imputation from deployment handling; it must be planned,
   not improvised. [Prediction-model development guidance, step 7](https://www.bmj.com/content/386/bmj-2023-078276).
3. **Frozen model artifact.** Record model/variant ID, version, exact
   equation, predictor definitions and boundaries, target, scope, sources,
   extraction location, content hash, review state and reviewer. New web
   evidence proposes a future version; it never mutates an active case's
   numerical parameters. Keep the current synthetic Bayes calculator
   explicitly separate.
4. **Pure deterministic calculation and audit.** Evaluate a stable sigmoid
   using confirmed inputs. Persist input IDs/versions, derived indicators,
   each coefficient contribution, total logit, output, model hash, engine
   version and eligibility result. Corrections produce a new calculation
   from the complete current input set. Historical replay needs neither
   Claude nor Tavily. An unchanged case does not receive another
   multiplicative update merely because another reasoning round ran.
5. **Independent reference fixtures.** Compare against separately calculated
   values for all 64 indicator combinations, test pulse 100 versus 101 and
   temperature below/equal/above 37.8, units, missing versus negative,
   conflicting observations, duplicate mentions, corrections, and replay.
   These verify software and extraction; they do not validate medicine.
6. **Scoped presentation.** Show the target and model/version alongside
   the result, inputs, limitations and sources. Do not turn the value into
   automatic diagnosis confirmation, an all-DDx confidence, or a treatment
   threshold. Do not append marginal symptom/test likelihood ratios to the
   joint model without a separately justified conditional model.

## Evaluation and remaining decisions

Correct arithmetic cannot establish calibration. External evaluation should
freeze the model, use independent outcomes in the intended population, and
report calibration curves, calibration-in-the-large, calibration slope,
discrimination, overall fit such as Brier score, uncertainty and clinically
relevant subgroup/threshold performance. AUC alone is insufficient;
Hosmer–Lemeshow P values are not an adequate calibration assessment.
Clinical utility requires its own evaluation. [Primary external-validation
guidance](https://www.bmj.com/content/384/bmj-2023-074820).

Choose evaluation sample size for desired precision, event frequency,
prediction distribution and decision-relevant performance measures.
Do not claim that an arbitrary 100 cases or a successful API smoke test
validates probabilities. [Primary sample-size guidance](https://www.bmj.com/content/384/bmj-2023-074821).

The remaining clinician/product decisions are:

- Is adult German primary-care acute cough the actual first demo target?
  If the chosen case is another syndrome, this model supplies no percentage
  for it.
- Adopt the precise external-validation S2 variant for an explicitly
  experimental calculator, or obtain original model/code clarification
  first? Who signs off the temperature boundary and measurement definitions?
- Which exclusions, urgency workflow and intended users apply, and who
  reviews clinical/statistical applicability? Urgent assessment remains
  independent of a low pneumonia estimate.
- Which independent German data and outcome ascertainment can support
  evaluation? If none are available, the deliverable remains a reproducible
  research/demo calculator with unestablished local calibration.
- What reuse terms apply to any embedded model materials or copied
  nomogram/table? The original PDF identifies noncommercial reuse terms;
  verify the intended artifact's rights rather than assuming that an open
  article supplies unrestricted model materials or patient data.

Access notes: BMJ/PMC browser fetches sometimes returned 403/challenge
pages. Original main text was read through its author-institution PDF;
the 2016 S2 PDF was fetched directly from PLOS, and the 2026 article was
read through Europe PMC full-text XML. No private patient data were used.
