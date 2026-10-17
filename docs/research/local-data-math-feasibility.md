# What the local frequency data can calculate

Research assessment, 17 October 2026. No runtime changes or clinical probabilities enabled.

**Yes, useful arithmetic is possible now. Population frequency plus patient context does not, by itself, identify a diagnostic probability.** The missing piece is applicable evidence linking findings to disease, not the existence of Bayes' theorem.

## Three inspected local records

Parsed the raw XML/TSV, not just the derived indexes. [Local manifest](../../data/reference/manifest.json) pins the July 2026 Orphadata release (June 23 export) and RKI commit `66c5b8632a9291af82849499d8c85f99fbdd2c25`.

| Record | Actual content | Defensible interpretation |
|---|---|---|
| ORPHA:586, cystic fibrosis, record `16684` | Germany; point prevalence; value and class; `11.1954` per 100,000; `Validated`; source `25914230[PMID]_ORPHANET` | `0.0111954%` population estimate. Record `16683` is instead birth prevalence `19.5017` per 100,000 births; do not average them. |
| ORPHA:73, Gorham-Stout, record `5267` | Worldwide; point prevalence; class only `<1 / 1,000,000`; `ValMoy=0.0`; `Validated`; source `ORPHANET` | A bound, not zero. No Germany-specific estimate; its separate 300-case record has no denominator. |
| RKI indicator `2020206`, measure `1`, 2024 | Known-diabetes prevalence; Germany; all sexes, adult ages and education groups; observed/weighted, not standardized; `10.3%`, 95% CI `9.8–10.8`; sample `26786`; uncertainty flag `0`; data status July 2, 2025 | RKI-Panel self-report of ever physician-diagnosed diabetes, excluding gestational-only cases, among German-speaking adults in private households. Not undiagnosed-disease probability; 2024 survey-method change is flagged. |

Sources: [Orphadata XML](https://www.orphadata.com/data/xml/en_product9_prev.xml), [pinned RKI TSV](https://raw.githubusercontent.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/66c5b8632a9291af82849499d8c85f99fbdd2c25/GBE_Indikatoren_nichtuebertragbarer_Erkrankungen.tsv), [pinned RKI methods](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/blob/66c5b8632a9291af82849499d8c85f99fbdd2c25/Readme.md). Orphadata's `Validated` is source curation, not calibration of our calculator; RKI's uncertainty flag likewise does not validate patient predictions.

## Defensible first numeric feature

Build a deterministic **population-frequency interpreter**: resolve a disease/indicator, select an eligible source record, convert its units or preserve its range, and return source, geography, period, subgroup and uncertainty. Keep a numerical estimate, a prevalence class and unavailable data distinct. This is a recommendation about the calculation contract, not a UI decision.

- For an eligible Orphadata **point-prevalence** value `v` per 100,000: population fraction = `v / 100000`; percentage = `v / 1000`; per million = `10v`. These are unit conversions, not new clinical estimates.
- A class `1–9 / 1,000,000` converts to `0.1–0.9 / 100,000` or `0.0001–0.0009%`. Preserve bounds; do not select the midpoint. A class is not a confidence interval. `<1 / million` retains its open upper bound and supplies no positive point estimate. `ValMoy=0.0` with class-only qualification is a missing-value sentinel, not zero prevalence. [Orphadata definitions, pp23–25](https://www.orphadata.com/docs/OrphadataScienceDataDescription.pdf)
- A population-rarity threshold can be compared with an appropriate prevalence estimate/range. The EC describes low prevalence as **less than 5 / 10,000 = 50 / 100,000 = 0.05%**. A `1–5 / 10,000` band alone cannot decide a strict `<5` test because it includes the boundary. Return indeterminate when a range spans/touches the decision boundary; keep Orphanet's curated classification separately. Incidence, birth prevalence and case counts cannot replace point prevalence. Geography still limits interpretation. [EC definition](https://health.ec.europa.eu/rare-diseases-and-european-reference-networks/rare-diseases_en)
- For RKI, select **one actual indicator and complete available stratum**: period, region, age, sex, education/deprivation, measure and standardization. A percentage can be converted to a fraction with its published confidence limits. Do not combine separate age and sex marginals into an invented joint subgroup, treat standardized rates as a patient's age-specific frequency, or extrapolate unavailable strata. [Indicator methods](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/blob/main/Readme.md)

Return unknown for ambiguous disease identity, incompatible metrics, missing geography/subgroups, conflicting eligible records or unavailable/uncertain values. Absence from Orphadata does not establish commonness. Source export date is not the underlying study period; the inspected XML records do not provide enough age/sex/time detail to manufacture a matched subgroup prior.

## Why this is not yet patient diagnostic math

Bayes needs a relevant pretest probability **and** a likelihood ratio for the observed result: `posttest odds = pretest odds × LR`. Population prevalence is not automatically the pretest probability among symptomatic patients referred to a particular setting. Age/sex matching improves population description but does not supply the missing symptom/test likelihoods. [Oxford CEBM method](https://www.cebm.ox.ac.uk/resources/ebm-tools/likelihood-ratios)

Missing inputs include a defined diagnostic target and reference standard; matching clinical setting and eligibility; applicable conditional likelihoods or a validated joint prediction model; predictor definitions and missingness rules; and evaluation of calibration in the intended population. Multiplying marginal symptom LRs assumes conditional independence and can double-count correlated evidence. Repeated rounds or duplicate mentions must not apply an observation twice.

Normalizing LLM percentages changes their sum, not their empirical calibration. Citation counts measure retrieval/publication patterns, not `P(findings | disease)`. Overlapping diseases, parent/subtype entities and comorbidity also prevent treating all table rows as mutually exclusive exhaustive alternatives. This does not claim LLM probabilities can never be calibrated: any proposed method needs a defined target and independent outcome evaluation.

**A narrow later Bayes calculator is possible:** a reviewed, setting-appropriate prior plus a validated applicable test LR can support one binary update, with uncertainty and clinician-confirmed observations. Freeze and review the parameters; fresh web search must not silently rewrite an active calculation. A joint model is needed when combining dependent predictors unless conditional likelihoods are justified.

**Synthetic arithmetic only:** with an invented pretest probability of 1% and invented LR+ of 5, prior odds = `0.01 / 0.99`; posterior odds = `5 / 99`; posterior probability = `5 / 104 = 4.81%`. Neither input comes from these downloads; this is not a patient recommendation or a demonstration of a calibrated model.

The published pneumonia equation already documented in [probability-model-readiness.md](probability-model-readiness.md) is a separate, narrowly scoped candidate with coefficients. Its existence does not turn this rarity/frequency collection into a DDx model, resolve its eligibility questions or establish German calibration.
