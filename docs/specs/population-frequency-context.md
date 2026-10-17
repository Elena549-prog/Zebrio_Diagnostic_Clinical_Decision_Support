# Population frequency in diagnostic reasoning

User-confirmed scope, 17 October 2026. Baseline before this task: `97baee4`.

## Intended behavior

Keep the existing desktop workspace and its persistent right-hand detail pane.
Selecting a diagnosis shows the agent's ordinal rank/reasoning and its distinct,
source-backed population frequency. A visible control expands calculation and
source details in that pane. Guided-tour probabilities remain illustrative.

Supply eligible local Orphadata records to the reasoning agent as contextual
evidence, including for newly proposed first-round diagnoses. Merely attaching
frequency after ranking is insufficient. Bound any additional inference pass;
record which exact reference context was available for that round. The agent
may interpret frequency alongside patient observations and other evidence;
its resulting order remains a model judgment, not a deterministic risk model.

Use deterministic matching, eligibility, unit conversion and presentation math:

- Exact preferred English/German names or explicit ORPHA identifiers.
- Curator-Validated point prevalence, preferring Germany then labelled Europe.
  These reference populations are not automatically matched patient cohorts.
- Exclude incidence, birth prevalence and case counts from point-prevalence math.
  Missing, ambiguous and class-only zero placeholders never become zero risk.
- Preserve individual records, ranges, inequalities and conflicts. No invented
  midpoints, pooled averages or manufactured confidence intervals.
- Percentage = published value per 100,000 / 1,000. Keep source precision,
  formula and display rounding inspectable, with geography, record identifiers,
  publication/catalogue links and dataset version/hash.
- Dataset release/export date is separate from the underlying observation period;
  show unknown where that period is unavailable.

No numerical patient probability is enabled. Population percentages do not
populate clinical probability fields or normalize into a differential. No
automatic exclusion of rare diagnoses. RKI remains a local research reference;
indicator-specific eligibility is needed before patient-context use.

Keep cancellation, staged-round rollback, history snapshots and clinician gates.
No autonomous test ordering, diagnosis confirmation or treatment decisions.

## Download freshness inspected locally

- Orphadata Science: July 2026 release, XML export 23 June 2026. The official
  [epidemiology page](https://sciences.orphadata.com/epidemiology/) still lists
  this release when checked on 17 October 2026. Release freshness does not date
  each source study; the inspected epidemiology records omit observation periods.
- RKI: pinned commit `66c5b8632a9291af82849499d8c85f99fbdd2c25`, committed
  23 September 2026. The downloaded TSV has row-level `Datenstand` values from
  20 November 2024 to 23 September 2026 and observation periods spanning
  1990 through 2025. These are different date concepts, not one freshness score.
  [Pinned dataset and methods](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/tree/66c5b8632a9291af82849499d8c85f99fbdd2c25).

Files and hashes are pinned in [the local manifest](../../data/reference/manifest.json).

## Validation

Fixture tests must establish that actual context reaches inference for new and
existing candidates, missing data remains honest, and conversion/bound handling
does not enable clinical probabilities. Check provenance through history and
inspect the right panel. Type checks and production build must pass before push.
