# Golden examples

Three **synthetic** patient presentations for testing the whole product and for the
demo. They are fictional, contain no identifiers, and pass the evidence expert's
privacy guard. They use the request shape of the Evidence Gathering Expert
(`presentation` with chief complaint, history, observations, demographics).

All three are common in German primary care or emergency medicine, and each has a
well-studied differential, so the evidence and probability steps have real
numbers to work with.

| # | File | Patient | Most likely diagnosis | Why it is a good demo |
|---|---|---|---|---|
| 1 | `golden-1-chest-pain.request.json` | 64-year-old man, Leipzig | Stable coronary heart disease / angina pectoris | Chest pain is a top GP consultation; the Marburg Heart Score was developed and validated in German primary care |
| 2 | `golden-2-breathlessness.request.json` | 79-year-old woman, Kiel | Acute decompensated heart failure | Heart failure is the most common reason for hospital admission in Germany; overlaps with pneumonia and COPD, so the differential is genuinely contested |
| 3 | `golden-3-dysuria.request.json` | 27-year-old woman, Munich | Acute uncomplicated cystitis | Very common, clear-cut case; shows the system converging quickly |

## What each part of the product should do

The "expected" items below are a clinician-style sanity check written by the team,
**not verified facts and not citations**. The product must find and verify its own
sources. Use these lists only to judge whether output looks plausible.

### 1. Chest pain on exertion (64, male)

- **Findings the system should pick up:** exertional retrosternal pressure relieved by
  rest; pain not reproducible by palpation; patient assumes cardiac cause; male ≥ 55;
  known vascular risk (hypertension, diabetes, smoking, family history); normal resting ECG.
- **Expected differential:** stable angina / coronary heart disease (leading);
  musculoskeletal chest wall pain; gastro-oesophageal reflux; less likely acute
  coronary syndrome (no rest pain, normal ECG).
- **Evidence the expert is likely to find:** primary-care studies of chest pain
  prediction rules (Marburg Heart Score), likelihood ratios for exertional pain and
  palpation-reproducible pain, prevalence of coronary disease among GP chest-pain patients.
- **Coding (Person 2, verify against ICD-10-GM 2026):** angina pectoris (I20.-) or
  chronic ischaemic heart disease (I25.-) as candidates; documented comorbidities
  hypertension (I10.-) and type 2 diabetes (E11.-). A normal ECG does not justify an
  acute infarction code.
- **Watch out for:** "Father had a heart attack" is family history, not a current
  diagnosis of the patient.

### 2. Increasing breathlessness and orthopnoea (79, female)

- **Findings the system should pick up:** orthopnoea, paroxysmal nocturnal dyspnoea,
  bilateral leg oedema, weight gain, raised JVP, bibasal crackles, raised NT-proBNP,
  stopped diuretics; no fever, low CRP.
- **Expected differential:** acute decompensated heart failure (leading);
  community-acquired pneumonia (less likely: afebrile, CRP 9); COPD exacerbation
  (unlikely: never smoked); pulmonary embolism (consider).
- **Evidence the expert is likely to find:** diagnostic accuracy of clinical signs and
  natriuretic peptides for heart failure in breathless patients (e.g. LRs for
  orthopnoea, PND, JVP, oedema, NT-proBNP thresholds).
- **Coding (Person 2):** heart failure (I50.-, specificity from the documentation:
  symptoms at rest point to the left-heart failure subcodes); atrial fibrillation (I48.-);
  hypertension (I10.-); old myocardial infarction (I25.2-).
- **Watch out for:** NT-proBNP thresholds depend on age; numbers from studies of younger
  or non-acute populations must carry a limitation.

### 3. Burning on urination (27, female)

- **Findings the system should pick up:** dysuria, frequency, urgency, no vaginal
  discharge or itching, no fever or flank pain, nitrite-positive and leukocyte-positive
  dipstick, negative pregnancy test.
- **Expected differential:** acute uncomplicated cystitis (leading); pyelonephritis
  (unlikely: afebrile, no flank pain); urethritis / sexually transmitted infection;
  vaginitis (unlikely: no discharge).
- **Evidence the expert is likely to find:** likelihood ratios of symptoms (dysuria,
  frequency, absence of discharge) and dipstick results (nitrite, leukocytes) for UTI
  in women; German S3 guideline on uncomplicated urinary tract infections (AWMF).
- **Coding (Person 2):** acute cystitis (N30.0). No pathogen code without a culture result.
- **Watch out for:** "No urinary infection in the past year" is a negated history,
  not a diagnosis.

## How to run

Evidence Gathering Expert (needs `ANTHROPIC_API_KEY` in the repo-root `.env.local`):

```bash
cd evidence-gathering-expert
npm run evidence -- ../examples/golden/golden-1-chest-pain.request.json
```

The orchestrator (Person 3) should send the same `presentation` object through the
whole pipeline. For Person 2, the free text maps onto `excerpts[]` (one excerpt each
for chief complaint, history and each observation).

## Fixed demo result

Live results vary from run to run, so a good run of example 2 is saved for the demo:

- `golden-2-breathlessness.response.json`: the full response (2026-10-17, Tavily on).
- `golden-2-breathlessness.summary.txt`: the readable summary with clickable source links.

It has 3 verified numbers out of 12 (heart failure base rate 47%, raised JVP specificity
0.70, pulmonary embolism base rate 18%), each with an exact quote, a link and a
population warning. The base rates come from other study populations (all ED
dyspnoea; acute respiratory failure), so they are not this patient's probability.
Show this file on stage; run live only as an extra.

## In the Arbor app

All three are live scenario cards (`web/src/goldenScenarios.ts`). The app imports
each `*.request.json` and sends its `presentation` unchanged; the "expected" items
above and the saved response are not imported. Example 2 is the prominent golden
live preset. Its optional result sheet (ECG, chest X-ray, echocardiogram) is
written by us, marked synthetic and "not in golden source", and only fills the
result box. `web/src/goldenScenarios.test.ts` (run by `npm test`) checks the
mapping is exact and that nothing above leaks into the cards.

If you change a request file, the app changes with it. Keep the "expected" items
here out of the request files.

## Ground rules

- Keep these examples synthetic. Never replace them with real patient data.
- If an example changes, update this README so the expectations still match.
