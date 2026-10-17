# Golden examples

Three **synthetic** adult patient presentations for testing the whole product and for the
demo. They are fictional, contain no identifiers, and pass the evidence expert's
privacy guard. They use the request shape of the Evidence Gathering Expert
(`presentation` with chief complaint, history, observations, demographics).

The set is chosen so that, together, the three cover the whole pipeline (presentation →
reasoning tree → evidence → ICD-10-GM coding → probability → decision) and three of the
four decision outcomes in the UI flow (confirm, investigate/park, refer/unresolved).

| # | File | Patient | Most likely diagnosis | UI outcome it demos | What it stresses |
|---|---|---|---|---|---|
| 1 | `golden-1-chest-pain.request.json` | 64-year-old man, Leipzig | Stable coronary heart disease / angina pectoris | **Investigate / park**: exercise ECG or troponin chosen at the test gate, case waits for results | Must-not-miss acute coronary syndrome pinned on the tree; the family-history trap; Marburg Heart Score, validated in German primary care |
| 2 | `golden-2-breathlessness.request.json` | 79-year-old woman, Kiel | Acute decompensated heart failure | **Confirm** → working diagnosis and treatment plan | Genuinely contested differential (pneumonia, COPD, PE); multimorbid coding where specificity comes from the documentation; age-dependent NT-proBNP; the saved demo result |
| 3 | `golden-3-weight-loss.request.json` | 58-year-old man, Hamburg | Open: colorectal cancer is the leading concern, no diagnosis can be confirmed in one visit | **Refer / remain unresolved** → referral summary and safety-net advice | Broad differential with a zebra, a must-not-miss cancer, iron-deficiency anaemia as a pointer, safe "no diagnosis yet" outcome |

An optional extra, `extra/golden-extra-dysuria.request.json` (27-year-old woman, acute
uncomplicated cystitis), shows the system converging quickly. It is not part of the top 3.

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

### 3. Unintentional weight loss and tiredness (58, male)

- **Findings the system should pick up:** unintentional 8 kg weight loss over 3 months;
  reduced appetite; looser stools and one episode of blood on the stool; night sweats
  without fever; Hb 10.4 g/dl with low MCV (iron-deficiency pattern); mildly raised CRP;
  smoker (30 years) and daily alcohol; mother with colon cancer at 62; no palpable
  lymph nodes, no abdominal mass, normal glucose.
- **Expected differential:** colorectal cancer (leading concern: bleeding, anaemia,
  family history, weight loss); lung cancer (smoker, but no cough); inflammatory bowel
  disease; hyperthyroidism and diabetes (unlikely: no goitre, normal glucose);
  lymphoma (night sweats, but no nodes); tuberculosis (zebra: no exposure, no cough);
  depression and alcohol-related causes as non-malignant contributors.
- **Evidence the expert is likely to find:** positive predictive values of unexplained
  weight loss, rectal bleeding and iron-deficiency anaemia for colorectal cancer in
  primary care; NICE NG12 (suspected cancer) evidence reviews; faecal immunochemical
  test (FIT) accuracy.
- **Coding (Person 2, verify against ICD-10-GM 2026):** symptom codes while nothing is
  confirmed: abnormal weight loss (R63.4), iron-deficiency anaemia (D50.-), melaena or
  rectal bleeding (K92.1 / K62.5). Never a cancer code (C18.-, C20) without a histology
  result.
- **Watch out for:** "mother had colon cancer" is family history, not the patient's
  diagnosis; "no cough", "no fever" and "no abdominal pain" are negations; a suspected
  cancer is not a coded cancer.
- **Honest gap (live runs 2026-10-17):** two live runs gave 0 and 1 verified numbers out of
  about 12, all with insufficient evidence for the colorectal cancer base rate, and the
  model's differential left out hyperthyroidism and diabetes. The case is therefore
  strong for the UI and coding steps, weaker for the evidence step. Do not present these
  runs as a fixed result.

### Extra: burning on urination (27, female)

Acute uncomplicated cystitis (N30.0) is the leading diagnosis; pyelonephritis, urethritis
and vaginitis are unlikely (afebrile, no flank pain, no discharge). Useful evidence: German
S3 guideline on uncomplicated urinary tract infections (AWMF) and dipstick likelihood
ratios. No pathogen code without a culture. "No urinary infection in the past year" is a
negated history, not a diagnosis.

## How to run

Evidence Gathering Expert (needs `ANTHROPIC_API_KEY` in the repo-root `.env.local`):

```bash
cd evidence-gathering-expert
npm run evidence -- ../examples/golden/golden-1-chest-pain.request.json   # also golden-2-…, golden-3-weight-loss
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
