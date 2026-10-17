# German disease-frequency sources: open versus restricted

Checked 17 October 2026. Research only; no application wiring or probability changes.

**Yes: there is authoritative, openly licensed German population-frequency data we can download now.** It is not an exhaustive disease-rarity database or a validated patient-specific diagnostic model. For broad rare-disease coverage, use the separate Orphadata investigation; the strongest German complement here is RKI's aggregate health-reporting dataset.

## Use now: RKI health reporting / NCD surveillance

**Verdict: open aggregate data, CC BY 4.0, no account or key.** The official repository supplies a TSV, metadata and detailed indicator methods; a versioned Zenodo release supports reproducibility. CC BY permits commercial reuse with attribution, a license link and indication of modifications; it does not imply RKI endorsement. [Repository](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen), [license](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/blob/main/LICENSE).

The current documentation describes 90 indicators, including selected disease prevalences such as coronary heart disease, stroke and diabetes, alongside incidence, mortality and other health indicators. Available periods, age ranges, regions and populations vary by indicator; much of the collection concerns adults, with some pediatric diabetes indicators. Sources include surveys, official statistics, registers and statutory-insurance claims. Methods and eligibility must be checked per indicator: self-reported diagnosed disease, administrative diagnoses and measured disease are different estimands. [Dataset methods and indicator catalogue](https://github.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/blob/main/Readme.md).

**Actual retrieval verified:** an unauthenticated HTTPS GET of the [raw TSV](https://raw.githubusercontent.com/robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen/main/GBE_Indikatoren_nichtuebertragbarer_Erkrankungen.tsv) returned HTTP 200. Its header includes indicator/measure definitions, period, sex, age, region, education, deprivation, standardization, value, lower/upper confidence interval, cases, sample, uncertainty and release date. The file was inspected in memory; no patient data or credentials were involved.

Recommended first use: a cited population-frequency card, retaining definition, period, geography, subgroup, uncertainty and source. Pin the release rather than silently tracking `main`. Do not convert every indicator into an ICD-specific prevalence: the source does not provide that universal mapping.

## Useful to cite, not cleared for unrestricted ingestion: Zi Versorgungsatlas

**Verdict: publicly readable studies and exports; general terms are restrictive, not open data.** The [rare-disease study](https://www.versorgungsatlas.de/themen/alle-analysen-nach-datum-sortiert/63/einleitung) analyzes 88 selected rare conditions using German outpatient billing data from 2008–2011. Its [full report](https://www.versorgungsatlas.de/fileadmin/ziva_docs/63/VA-63-2015-Seltene%20Erkrankungen-Bericht-V3.pdf) uses the resident statutory-insured population from KM6 as denominator. This is old administrative prevalence, not complete current German rare-disease coverage. The [results interface](https://www.versorgungsatlas.de/themen/alle-analysen-nach-datum-sortiert/63/zeitreihen) advertises Excel export; no stable public API or actual export download was verified here.

The site's [disclaimer](https://www.versorgungsatlas.de/footer/disclaimer) limits downloads/copies to private, noncommercial use and requires written consent for exploitation beyond copyright exceptions. Its [imprint](https://www.versorgungsatlas.de/meta/impressum) welcomes attributed quotations and links, but explicitly says public availability does not authorize other third-party use. **Use links/citations now; defer bulk commercial integration until permission or a specific dataset license is obtained.**

## Public infection surveillance: RKI SurvStat

**Verdict: public aggregate queries; publication with attribution allowed; unrestricted bulk/commercial redistribution not established.** [SurvStat](https://survstat.rki.de/Default.aspx) concerns notified infections/pathogen detections under the German Infection Protection Act, not all diseases. Its [usage page](https://survstat.rki.de/Content/Instruction/DataUsage.aspx) permits publication of generated analyses with a reference and query date. No current supported programmatic API or download execution was verified. Treat notification counts/incidence separately from prevalence, and respect differences in reporting coverage. This is a later contextual source, not the first general rarity import.

## Restricted counterexample: individual cancer-registry research data

**Verdict: controlled access, not an open bulk dataset for our application.** The ZfKD makes epidemiological and clinical research datasets available on application with a demonstrated scientific interest; the clinical dataset starts at diagnosis year 2020. [Research-data access](https://www.krebsdaten.de/Krebs/DE/Content/Forschungsdaten/forschungsdaten_node.html). Applications require the scientific purpose, requested scope, methods and participating people, followed by review and approval. [Application requirements](https://www.krebsdaten.de/Krebs/DE/Content/Forschungsdaten/Informationen_Antragstellung/info_antrag_node.html). Public aggregate cancer statistics are a separate product; their availability does not open the underlying individual records. Defer microdata access to a properly scoped research project.

## Avoid a misleading source

[SE-ATLAS](https://www.se-atlas.de/aboutus/faq) is a directory of rare-disease care providers and patient organizations. A count of listed centers is **not** a disease prevalence or a patient count.

## Product implication

Design inference: these sources can support an attributed statement about how common a condition is in a specified population. They cannot, by themselves, establish this particular symptomatic patient's probability, calibrate an LLM's percentages or validate an entire differential. Preserve `unknown` when no suitable estimate exists; absence from the dataset is not proof of rarity. Keep population rarity separate from urgency and from case-specific likelihood.
