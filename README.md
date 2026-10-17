# Claude_Hackathon_Berlin
This will be the central repo to build our project. Go team!! :)

## Data sources (Evidence Gathering Expert)

The evidence expert (`evidence-gathering-expert/`, see its
[HANDOFF.md](evidence-gathering-expert/HANDOFF.md)) only uses free, public sources.
None of them needs an API key.

| Order | Source | What it reads |
|---|---|---|
| 1 | [Europe PMC](https://europepmc.org) | Full text of open-access papers; otherwise the abstract. Searches title and abstract. |
| 2 | [PubMed](https://pubmed.ncbi.nlm.nih.gov) | Abstracts; used when Europe PMC finds nothing or fails. |
| 3 | Guideline websites via [DuckDuckGo](https://lite.duckduckgo.com/lite/) | The guideline page itself, limited to nice.org.uk, cdc.gov, who.int, idsociety.org, awmf.org, sst.dk and escmid.org. |

- Sources are ranked: guideline > systematic review / meta-analysis > RCT >
  observational > other, newer first; up to 5 per question.
- A number only counts when its exact quote is found in the text we retrieved and an
  independent second check agrees. Every result links to the page it came from.
- DuckDuckGo has no official API and often blocks automated searches; when it does,
  guidelines are skipped (never bypassed) and papers still work.
- Patient text is never sent to these services: search queries contain medical
  concept words only.
