# Follow-up live workflow verification

Run started: 2026-10-17T11:41:11.613Z. API: http://127.0.0.1:8788. Only synthetic clinical material and explicit synthetic clinician actions were used. No model-access probes were repeated. At most two advances and one treatment request were issued, without application-level retries.

## Observed checks

- **PASS — health:** {"provider":"anthropic","models":{"orchestrator":"claude-opus-5-5","researcher":"claude-haiku-5-5","validator":"claude-sonnet-5-5","coding":"claude-sonnet-5-5","treatment":"claude-sonnet-5-5","chat":"claude-sonnet-5-5"},"probabilityMode":"unavailable"}
- **PASS — first_round:** {"hypotheses":7,"sources":2,"findings":5,"awaitingHitl":false,"pendingDiagnosis":false}
- **PASS — explicit_synthetic_clinician_finding:** {"gateCleared":true,"recordedTestResult":false}
- **PASS — second_round:** {"hypotheses":7,"sources":2,"findings":6,"historyFrames":4,"retainedInitialHypotheses":true,"sourceIndicesStable":true,"pendingDiagnosis":false}
- **PASS — explicit_synthetic_diagnosis_confirmation:** {"status":"converged","confirmed":true,"confidenceAbsent":true,"selectionPurpose":"API workflow test only; not a clinical conclusion."}
- **PASS — treatment:** {"status":"closed","stepCount":5,"citedSteps":2,"uncitedSteps":3,"historyFrames":6,"novelSourceUrls":false}
- **PARTIAL — treatment_claim_validation:** Only source URL membership is mechanically enforced by current runtime. Claim support, dosage, applicability, and cited passage entailment require review; source URLs alone do not establish those properties.
- **PASS — synthetic_case_cleanup:** {"httpStatus":204}

## Sanitized treatment and source excerpts

```json
{
  "summary": "The supplied sources cover group A strep (GAS) pharyngitis and antibiotic restraint. Neither covers infectious mononucleosis/EBV diagnosis or management. The documented picture (2 days of sore throat, cough and rhinorrhea, temperature 37.5 C, no exudate, now improving) is nonspecific, and no EBV testing is recorded. The plan below is therefore conservative. It is limited to what the sources support, and the clinician should review anything beyond that.",
  "steps": [
    {
      "title": "Re-check the working diagnosis against the documented findings",
      "detail": "Nothing in the supplied sources supports or refutes EBV mononucleosis. The cough, coryza, low-grade temperature and absence of exudate fit a common viral pharyngitis. S1 states that viruses are the most common cause of pharyngitis in all age groups. That is population-level information and cannot confirm or exclude EBV in this patient. No EBV-specific testing or examination findings are documented. Whether further evaluation is warranted is a clinician decision, and the supplied sources give no evidence on it.",
      "citation": {
        "label": "Clinical Guidance for Group A Streptococcal Pharyngitis | Group A Strep | CDC",
        "url": "https://www.cdc.gov/group-a-strep/hcp/clinical-guidance/strep-throat.html"
      }
    },
    {
      "title": "If GAS is still a concern, interpret any testing within its limits",
      "detail": "S1 says rapid antigen tests (RADTs) are highly specific but have variable sensitivity compared with throat culture, which is the gold standard. A negative RADT therefore does not reliably exclude GAS. S1 recommends backup culture after a negative RADT for children older than 3 years, and the retrieved text indicates routine culture is not indicated for other ages. This patient is 30. S1 also notes that GAS pharyngitis is most common at ages 5–15, but this is epidemiology and does not decide the individual case. The sources do not say whether this adult should be tested at all. The clinician should decide using their own clinical assessment.",
      "citation": {
        "label": "Clinical Guidance for Group A Streptococcal Pharyngitis | Group A Strep | CDC",
        "url": "https://www.cdc.gov/group-a-strep/hcp/clinical-guidance/strep-throat.html"
      }
    },
    {
      "title": "Be cautious about starting antibiotics",
      "detail": "The abstract of a Canadian family medicine review (S2) advises restraint in starting antibiotics for pharyngitis. It states that restraint does not delay recovery or increase the risk of S pyogenes infections. This is abstract-only evidence from a narrative review, and S2 cannot be cited as a step reference under this schema. No supplied source addresses antibiotics specifically in mononucleosis, so any antibiotic decision needs clinician review."
    },
    {
      "title": "Take the clinician follow-up into account",
      "detail": "The follow-up note records that the sore throat is improving, with a persistent mild cough and no new breathing difficulty. The supplied sources give no guidance on follow-up intervals, return precautions or when to escalate, so the clinician should set these. Evidence is missing here."
    },
    {
      "title": "Identify evidence gaps before acting on the EBV label",
      "detail": "The sources do not cover EBV confirmatory testing, symptomatic care, activity or splenic-injury advice, complication surveillance, or expected course. Retrieving EBV-specific, guideline-level sources is needed before making EBV-specific management suggestions. Treatment decisions remain with the clinician."
    }
  ],
  "sourceExcerpts": [
    {
      "index": 1,
      "url": "https://www.cdc.gov/group-a-strep/hcp/clinical-guidance/strep-throat.html",
      "excerptPreview": "Group A strep pharyngitis is most common among children 5 through 15 years of age. It's rare in children younger"
    },
    {
      "index": 2,
      "url": "https://pubmed.ncbi.nlm.nih.gov/32273409",
      "excerptPreview": "Physicians should exercise restraint in antibiotic initiation for pharyngitis, as restraint does not delay recovery or increase the risk of"
    }
  ]
}
```

## Source-grounding limitations

The treatment runtime provides the existing source pool and asks for supported suggestions, but resolves citations solely by source-reference membership. It performs no independent claim-to-passage check, and it accepts uncited steps. It does not fetch management-specific evidence at treatment time. Case-finding sites can therefore inherit a valid source URL without demonstrating the source actually describes that clinical site or outcome.

The temporary coding adapter checks an official code and label together in retrieved catalogue text and requires a cited passage, which establishes reference provenance. Interpretation of patient documentation, mention status, terminal-code completeness, and coding-rule applicability still relies partly on the model. The HTTP integration does not independently re-run these semantic checks on an externally replaced coding module; teammate integration needs a contract and tests for them.

This verifies execution, state transitions, and citation membership. It does not establish diagnostic accuracy, correct clinical management, or calibrated probabilities. A synthetic clinician selecting a live hypothesis is an API exercise, not a clinical conclusion.

## Observed output limitation

The generated plan correctly acknowledged that the confirmed synthetic EBV label had no EBV-specific management support in the retrieved sources. It nevertheless said source S2 could not be used as a step reference under the schema, although `sourceRef` can resolve any existing source. This is a generated explanation error; it demonstrates why response-shape success and valid citation URLs should not be reported as factual correctness. The synthetic confirmation selected a live hypothesis solely to exercise the API; it was not a clinical endorsement.
