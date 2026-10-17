# Zebrio

Zebrio helps GPs and pediatricians accurately track and support diagnostic
clinical decision-making and reasoning for individual patient case files.

For each patient, Zebrio lists the possible diagnoses, suggests the next test,
and shows the medical evidence for and against each option. Rare diseases stay
on the list until a real finding rules them out. The doctor makes every
decision, and every step is saved in the patient's case file.

Demo video: (https://youtu.be/kTYJrZP4ERY)

## Who it is for

- **GPs (Hausärzt\*innen):** patients with unclear or recurring symptoms, where
  the GP has to decide what to test and when to refer.
- **Pediatricians (Kinder- und Jugendmedizin):** children with symptoms that
  could point to a rare or inherited disease. Most rare diseases start in
  childhood.
- Also useful for internists, neurologists and rare disease centers, and for
  teaching medical students how a diagnosis is narrowed down.

## The problem

Most people will have at least one diagnostic error in their lifetime
([US National Academies, 2015](https://www.nationalacademies.org/read/21794/chapter/2)).
In Europe, a rare disease takes 4.7 years to diagnose on average
([Rare Barometer, 2024](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11369105/)),
and about 4 million people in Germany live with one
([ACHSE](https://www.achse-online.de/de/Aktuelles/PDF/Kurzbeschreibung_ACHSE.pdf)).

A GP has a few minutes per patient. There is no time to search the literature
for every possible cause, so doctors go with the most likely answer and rare
diseases get missed. AI chatbots give answers without sources, so doctors
cannot rely on them.

## What Zebrio does

1. Lists the possible diagnoses as a tree. Common ones rank first. Rare ones
   are marked and stay on the tree.
2. Suggests the test that best separates the remaining options.
3. Shows the evidence for and against each diagnosis, with a link and the exact
   quote from a medical source (PubMed, NICE, WHO, CDC, AWMF, Cochrane). If the
   quote cannot be found in the source, the claim is not used.
4. Shows how rare each disease is, from published Orphanet data.
5. Suggests the German ICD-10-GM code, linked to the official BfArM catalogue.
6. Saves every step on a timeline, so the doctor can go back or try a
   different test result.
7. Leaves the decisions to the doctor. Zebrio cannot order a test, enter a
   result or confirm a diagnosis. Once the doctor confirms, it drafts a
   treatment plan from the collected sources.

## Example

A 79-year-old woman in Kiel has been getting more short of breath for 10 days.
She now sleeps on three pillows, her ankles are swollen, and she has gained
3 kg in a week. She has atrial fibrillation, high blood pressure and a past
heart attack, and she stopped her water tablets two weeks ago.

1. Zebrio lists the possible diagnoses: acute heart failure, pneumonia, COPD
   flare-up and pulmonary embolism. Heart failure ranks first. Pulmonary
   embolism is dangerous, so it stays on the list.
2. It shows the evidence with sources. For example, in a large study of
   breathless emergency patients, 47% had heart failure
   ([PubMed 12124404](https://pubmed.ncbi.nlm.nih.gov/12124404/)), and raised
   neck-vein pressure has a specificity of 70% for heart failure
   ([PubMed 19586584](https://pubmed.ncbi.nlm.nih.gov/19586584/)).
3. It suggests ICD-10-GM codes for her documented conditions, such as heart
   failure (I50), atrial fibrillation (I48) and high blood pressure (I10).
4. The doctor confirms acute heart failure. Zebrio drafts a treatment plan,
   with sources.

Without Zebrio, the doctor keeps four diagnoses in their head, searches for
evidence on each one, and writes up the reasoning by hand. With Zebrio, all of
it is on one screen and saved in the case file.

## Impact

- **Fewer missed diagnoses:** rare and dangerous causes stay visible until a
  real finding rules them out.
- **Faster work-up:** evidence search, source checking and coding run in one
  round of one to two minutes.
- **Clearer decisions:** the doctor sees *why* each cause ranks where it does,
  and can explain it to the patient, a colleague or a specialist.
- **AI doctors can trust:** every piece of evidence has a source, and the
  doctor stays in charge.

## How Claude is used

Claude Opus builds the list of diagnoses and suggests tests. Claude Haiku plans
the searches. Claude Sonnet checks quotes against their sources, picks
ICD-10-GM codes, drafts treatment plans and answers questions about the case.

## Run it

You need Node.js 22.12 or newer.

```bash
git clone https://github.com/Elena549-prog/Zebrio_Diagnostic_Clinical_Decision_Support.git
cd Zebrio_Diagnostic_Clinical_Decision_Support
npm install
npm run dev
```

Open http://localhost:5175.

- Without an API key: click **Take the guided tour** to see every feature on a sample case.
- With keys: copy `.env.example` to `.env`, add `ANTHROPIC_API_KEY` and
  `TAVILY_API_KEY`, and restart. Open a live case (breathlessness, the example above;
  chest pressure on exertion; or burning on urination) and click
  **Advance a round**.

Run the tests with `npm test`.

## Safety

Zebrio is a prototype, not a medical device. The demo patients are made up.
Do not enter real patient data. Only medical terms from a fixed list are sent
to search engines. Zebrio does not show patient probabilities, and a doctor
must review every code and treatment it suggests.

## Credits

Claude (Anthropic), Tavily and DuckDuckGo (search), Orphadata (Orphanet,
© INSERM 1999, CC BY 4.0), BfArM ICD-10-GM 2026, React, Vite, Express and
TypeScript.
