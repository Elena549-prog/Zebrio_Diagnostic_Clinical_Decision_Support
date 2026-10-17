# Claude_Hackathon_Berlin
This will be the central repo to build our project. Go team!! :)

## Data sources (Evidence Gathering Expert)

The evidence expert (`evidence-gathering-expert/`, see its
[HANDOFF.md](evidence-gathering-expert/HANDOFF.md)) only uses free, public sources.
Only Tavily needs an API key (free plan).

| Order | Source | What it reads |
|---|---|---|
| 1 | [Europe PMC](https://europepmc.org) | Full text of open-access papers; otherwise the abstract. Searches title and abstract. |
| 2 | [PubMed](https://pubmed.ncbi.nlm.nih.gov) | Abstracts; used when Europe PMC finds nothing or fails. |
| 3 | Guideline websites via [Tavily](https://tavily.com) (fallback: [DuckDuckGo](https://lite.duckduckgo.com/lite/)) | The guideline page text, limited to nice.org.uk, cdc.gov, who.int, idsociety.org, awmf.org, sst.dk and escmid.org. |

- Each question is searched several ways in Europe PMC: by relevance, by citation
  count (to surface the classic, highly cited studies), by care setting (primary care,
  general practice, emergency department) for base rates, and among systematic reviews
  and clinical prediction rules.
- Preprints (not peer reviewed) are excluded. Case reports are ranked last, because a
  single patient cannot give a base rate or a likelihood ratio.
- Sources are ranked: guideline > systematic review / meta-analysis > RCT >
  observational > other > case report, newer first; up to 8 per question.
- A number only counts when its exact quote is found in the text we retrieved and an
  independent second check agrees. If the study population differs from the patient
  (e.g. all ages, another care setting), the number still counts but carries a written
  warning. Every result links to the page it came from.
- Tavily (free plan, 1,000 credits a month) is used for at most one search per diagnosis
  (max 3 credits per patient) and is capped locally at 900 credits a month
  (`TAVILY_MONTHLY_CREDIT_LIMIT`), so the free plan is never exceeded. Without a key, or
  when the cap is reached, DuckDuckGo is used; it often blocks automated searches, and
  then guidelines are skipped (never bypassed) and papers still work.
- Patient text is never sent to these services: search queries contain medical
  concept words only.
