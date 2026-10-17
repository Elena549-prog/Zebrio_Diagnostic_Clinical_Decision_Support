# Local reference sources

Run `npm run data:sync` from the repository root (Python 3 standard library).
No credentials, API subscription or paid calls are required. The script downloads
English/German Orphadata epidemiology XML, RKI aggregate TSV, its methods and
licence, then builds local JSON indexes. Raw files and generated indexes are
git-ignored; `manifest.json` records exact URLs, dates, hashes and licences.

Default sync reproduces the recorded files, using matching cached downloads or
checking fetched bytes against their SHA-256 hashes. An intentional upstream
update is `npm run data:sync -- --refresh`. Review the changed manifest before
adopting new estimates. RKI downloads are pinned to a Git commit. Orphadata's
download URL is mutable; a mismatch fails instead of silently updating it.

## Orphadata Science

- [Official epidemiology release and downloads](https://sciences.orphadata.com/epidemiology/)
- [Definitions and limitations](https://www.orphadata.com/docs/OrphadataScienceDataDescription.pdf)
- [Licence, attribution and AI-use guidance](https://www.orphadata.com/faq/)

Attribution: Orphadata Science: Free access data from Orphanet. © INSERM 1999.
Data version is recorded in the manifest. **CC BY 4.0**, including commercial
reuse with attribution and identification of modifications. This importer
normalizes XML to JSON and joins preferred English/German names by ORPHAcode;
it does not add inferred synonyms or treat ICD codes as exact identity matches.

Arbor uses Orphadata to derive displays in an AI-assisted tool. Generated
results may not accurately reflect Orphanet/Orphadata data. Orphanet/Orphadata
is not responsible for generated outputs and does not endorse the application.

The runtime resolves exact preferred names or explicit ORPHA identifiers. It
uses only curator-Validated **point prevalence**, preferring Germany then
explicitly labelled Europe. Group/category entities, missing/ambiguous names,
unvalidated data, case counts, incidence and birth prevalence do not establish
the rarity label. Unknown is not common and missing values are not zero.

Reference arithmetic compares estimates/bounds with 50 per 100,000 (5/10,000).
It labels only estimates strictly below/above this boundary; an exact boundary,
straddling range or mixed estimates remains uncertain. This is a conservative
comparison, not a legal disease-designation decision. Class-only bands stay
bands; their `ValMoy=0` placeholder is never used as zero prevalence. A data
export date is not the date of each underlying study. Curation status is not
clinical validation of this application.

## RKI German health reporting

- [Official dataset, methods and downloads](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen)
- [CC BY 4.0 licence](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/blob/main/LICENSE)

Attribution: Robert Koch-Institut, *Gesundheitsberichterstattung – Daten zu
nichtübertragbaren Erkrankungen*, version/Git commit in `manifest.json`.
TSV-to-JSON conversion is performed locally; no RKI endorsement is implied.
Selected indicators preserve period, population, age/sex/region, methods and
uncertainty. This is not exhaustive disease coverage or a universal ICD map.
The files are available as a local reference; **RKI values are not automatically
assigned to hypotheses or used as patient priors**. Such use requires an
indicator-specific, clinically reviewed population/measurement mapping.

## Application connection

- `GET /api/reference-data`: availability, releases and both source links.
- `GET /api/reference-data/rarity?name=Cystic%20fibrosis` (or `ORPHA:586`):
  cited reference-population assessment, not a patient percentage.
- After each live reasoning round the server attaches reference provenance to
  matching hypotheses before the history snapshot. Detail panels expose sources,
  population, curation status and release; unsupported model rarity suggestions
  remain visibly distinguished. The guided tour remains illustrative.

The application starts without downloads and reports reference data unavailable.
The source links themselves require internet; local lookups require no network.
Neither dataset calculates clinical probabilities or changes clinician gates.

## Verification on 17 October 2026

Downloaded 6,728 Orphadata clinical entities (including groups and subtypes)
and 64,142 RKI rows. A repeat sync verified all five raw-file hashes and rebuilt
the indexes. Type checks, production build and all 72 automated tests passed.
Synthetic tests cover bilingual identity, ambiguity, incompatible metrics,
geography, validation status, bounds, missing values and history provenance.
The running app's API returned ORPHA:586's German point-prevalence record
16684 (11.1954 per 100,000, with its PubMed link) and unknown for an unmatched
query. These checks verify software/data handling, not clinical accuracy.


## Population context in reasoning

Live rounds supply exact-name/ORPHA matched, validated point-prevalence records
for existing candidates before inference. Newly proposed candidates trigger at
most one additional ordinal ranking review when new eligible numeric records
exist, including the first round. Lookups are capped at 24 candidates; inference
context includes at most 12 numeric records per candidate, with omissions logged.
All eligible Germany/Europe records remain separate in the attached assessment;
Germany is preferred for reasoning, Europe is explicitly a fallback, and neither
is assumed to match patient location. Conflicts are never averaged.

Round events carry a `population_context` audit: exact text and record IDs supplied
to each inference pass, dataset hash/release, missing lookups and omissions. This
is distinct from data attached after inference. Sources enter the existing S-ref
pool before ranking and remain clickable. Catalogue-linked publications are not
represented as independently validated patient evidence. Cancellation before the
review completes leaves the case unchanged. The clinician gates remain mandatory.

Percent conversion is deterministic: value per 100,000 divided by 1,000. Range
endpoints and inequality direction are preserved; no midpoint or zero placeholder
is introduced. Exact-value displays round to 4 significant digits (marked approximate); bound displays retain their numeric values without rounding; formula, source, raw
class, geography and unknown underlying study date remain inspectable. The dataset
release is a version date, not an underlying observation period. Patient likelihood
remains unquantified; ordinal agent ranking remains separate. RKI remains research-only.
