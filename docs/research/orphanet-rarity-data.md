# Orphanet / Orphadata rarity data: access and suitability

Checked 17 October 2026. Research only; no application changes or private credentials used.

**Verdict: we can use the public Orphadata Science epidemiology XML now, including commercially with attribution.** It supports a sourced population-rarity label. It does not supply a validated probability that a particular patient has a disease. The official catalogue explicitly distinguishes the free, contract-free Science files from other products. [Catalogue, April 2026](https://www.orphadata.com/docs/Catalogue_Orphadata.pdf)

## Exact public artifact tested

- Current release page: [Science epidemiology](https://sciences.orphadata.com/epidemiology/), labelled **July 2026**. It lists 6,728 clinical entities, including disorders, subtypes and groups; this is not a count of 6,728 independent diseases. German XML is offered alongside English.
- Download tested: [en_product9_prev.xml](https://www.orphadata.com/data/xml/en_product9_prev.xml), without authentication: **HTTP 200**, 16,178,169 bytes.
- XML root export date: `2026-06-23 07:57:58`; HTTP Last-Modified: `Mon, 29 Jun 2026 12:08:03 GMT`. The page's July release label and June export date are distinct metadata, not a study date.
- SHA-256: `6b492b3cc61e5a0327de12f59386a07a071760a938d0bbd8f525bc4a5f71b7f0`.
- The artifact itself embeds **Creative Commons Attribution 4.0 International / CC-BY-4.0**, matching the release page. No registration or API key was needed for the tested bulk download. Raw bulk data was parsed in memory and was not added to this repository.
- Actual parse: 17,108 epidemiological records; 221 have geography `Germany`. Germany coverage is partial. Entity presence and availability of a German-language file do not imply German population estimates.

Use the current `sciences.orphadata.com` release page: the older `www.orphadata.com/_epidemiology/` page still showed an older release during this check.

## What the records mean

An entity has an ORPHA identifier, name, stable source-page link, group/type and multiple records. Records retain metric, qualification, prevalence class, numeric value, geographic area, source and validation status. Metric types in the tested file include point prevalence, birth prevalence, annual incidence, lifetime prevalence and reported cases/families. `ValMoy` rates use a denominator of 100,000 in the documented example; cases/families are counts. A class-only `ValMoy=0.0` means no numeric estimate, not zero disease. [Data description V3, April 2026, pp22–25](https://www.orphadata.com/docs/OrphadataScienceDataDescription.pdf)

The tested artifact contains 15,232 records marked `Validated`, 1,873 `Not yet validated`, and 3 without a status. The official description says underlying study validity is not re-assessed and notes inconsistency and poor methods reporting. Thus “Validated” is a curation status, not clinical calibration of our product. Per-record study periods, age/sex strata and validation dates were not present in the sampled epidemiology records. [Data description](https://www.orphadata.com/docs/OrphadataScienceDataDescription.pdf)

## Three real examples from the tested XML

These are observations of the downloaded release, not independently re-estimated epidemiology. [Source artifact](https://www.orphadata.com/data/xml/en_product9_prev.xml)

- **Alpha-mannosidosis, ORPHA:61:** record `4`, Europe, point prevalence, class `1-9 / 1 000 000`, numeric `0.1` per 100,000, status `Validated`, source `European Medicines Agency 2005[OTHER]`. A 2026 export can contain an old source estimate.
- **Cystic fibrosis, ORPHA:586:** record `16684`, Germany, point prevalence `11.1954` per 100,000, class `1-5 / 10 000`, status `Validated`, source `25914230[PMID]_ORPHANET`. Separate record `16683` gives Germany **birth prevalence** `19.5017` per 100,000 births. These are different indicators and must not be substituted or averaged.
- **Gorham-Stout disease, ORPHA:73:** record `5267`, worldwide point-prevalence **class only** `<1 / 1 000 000`, status `Validated`, source `ORPHANET`. Raw `ValMoy=0.0` is missing numeric information. Another record reports 300 cases worldwide; that count has no population denominator.

## Licence and service boundaries

Science CC BY 4.0 permits commercial reuse with attribution and identification of changes. The FAQ additionally requests an AI-service statement acknowledging use of Orphanet/Orphadata and explaining that generated outputs may not accurately reflect the source and are not Orphanet's responsibility. Use the prescribed Science attribution with the data version; do not imply endorsement. [Official FAQ](https://www.orphadata.com/faq/)

The **API service is not the same access route as the public bulk file**: the current catalogue directs API users to contact Orphadata. Products/services can require a Data Transfer Agreement or contract depending on user/status; pricing and access should be confirmed before depending on the hosted API. This does not remove the tested bulk file's CC BY licence. [Catalogue](https://www.orphadata.com/docs/Catalogue_Orphadata.pdf), [Products access conditions](https://www.orphadata.com/orphadata-products/)

Detailed disease abstracts, expert directories and other Products can have separate contractual terms. Do not extend the epidemiology file's licence to all website content. [Catalogue](https://www.orphadata.com/docs/Catalogue_Orphadata.pdf)

## Recommended use in our app

The European Commission describes rare disease around the **5 per 10,000** population threshold. Use Orphanet's curated entity classification and explicit source geography for a label such as **“Rare disease — Orphanet; European classification”**. Avoid inventing an exact threshold decision from a coarse prevalence band. [European Commission](https://health.ec.europa.eu/rare-diseases-and-european-reference-networks/rare-diseases_en)

Recommended implementation, not yet wired in:

1. Import and pin the Science bulk release; retain licence, hash, export date and source links.
2. Resolve disease identity to an active ORPHA entity; retain ambiguity. ICD mappings can be broader than the ORPHA disease, so a shared ICD code is insufficient to inherit its rarity. Orphadata mapping files distinguish equivalence, broader/narrower and validation status. The ICD-10 mapping is not automatically an ICD-10-GM coding decision. [Official alignment documentation](https://sciences.orphadata.com/orphanet-scientific-knowledge-files/)
3. Present population rarity independently of patient fit and clinical urgency. Preserve geography, metric, source and status. Show “rarity unknown / no suitable estimate” when missing; absence from the dataset does not prove commonness.
4. Do not turn population prevalence into a patient diagnosis percentage, normalize rare/common labels into a differential, or treat case counts, incidence and birth prevalence as interchangeable priors. A symptomatic patient in a clinic is a different population; patient likelihood needs additional applicable evidence and evaluation.

Suggested attribution: “Orphadata Science: Free access data from Orphanet. © INSERM 1999. Data version July 2026 (XML export 23 June 2026). CC BY 4.0.” Link to the release, licence, individual entity and source. Include the AI statement above where the service uses this data.
