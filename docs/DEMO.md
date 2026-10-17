# Demo steps

The supplied tour and preset patients are synthetic. Nothing here is clinically validated.

## 1. Guided tour (no keys, no API calls)

1. `npm run dev`, open http://localhost:5175.
2. Click the card labelled **Canned tour · no API calls**.
3. Step with **Next →**. At the test gate the tour shows its one pre-written
   result; **Enter scripted result & advance** moves on. Percentages in the
   tour are labelled illustrative teaching values.
4. On the last step, **Run this case for real** starts a live case (uses credits).

## 2. Live demo preset (real Claude + Tavily calls)

Needs `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` in the root `.env`. The home
setup notice must say *Live reasoning is configured*. Each round makes several
model and search calls and can take one to two minutes.

1. Click **Live demo preset ★ — synthetic sore throat + fever**
   (badge: *Live · Claude + Tavily · synthetic patient*).
2. **Advance a round.** Read the status strip above the next-action card: it
   reports how many sources were retrieved and passage-checked, or says plainly
   that no literature was retrieved, and whether any ICD-10-GM code was verified.
3. Click tree nodes; the right panel shows rank, evidence, sources, and (where
   an exact Orphadata match exists) published population frequency with its
   conversion and record ID. Rank is ordinal; there is no patient probability.
4. If the model proposes a test, you are the clinician: type the result in
   **Enter the test result**. The **Synthetic result sheet** only fills the
   text box; check it fits the proposed test, set the direction, then
   **Add result & advance**. If the model proposed a different test, write your
   own synthetic result. (Generated “Synthetic example results” chips also
   exist; they record a result prefixed “Synthetic demo result” in one click.)
5. When the engine proposes a working diagnosis, either **Confirm proposed
   working dx** or add another finding and advance to reconsider. The model
   never confirms by itself.
6. **Build treatment plan.** Treatment output is a model suggestion for review.
7. Optional: scrub the timeline to review earlier steps. Turn **Forking** on to
   branch a what-if from a past step; findings there are marked hypothetical.

Cases live in server memory and disappear when the server restarts.

## 3. Golden live preset: breathlessness (real Claude + Tavily calls)

Same keys and flow as section 2. The card **Golden live preset ★ —
breathlessness, 79-year-old woman (Kiel)** (badge: *Live · Claude + Tavily ·
synthetic golden example*) sends `examples/golden/golden-2-breathlessness.request.json`
`presentation` unchanged, so the app and the evidence expert run the same story.

1. Click the card and **Advance a round**. The model sees only the presentation;
   no expected diagnosis and no saved response is sent or shown.
2. If the model proposes an ECG, chest X-ray or echocardiogram, the
   **Synthetic result sheet** has a matching synthetic line (marked *not in
   golden source*). It only fills the box: check it matches the proposed test,
   set the direction, then submit. For any other test, write your own result.
3. Continue as in section 2, steps 5–7.

Golden examples 1 (chest pressure, Leipzig) and 3 (dysuria, Munich) are also
live cards with the same verbatim mapping and no result sheet.

**The saved run is separate.** `examples/golden/golden-2-breathlessness.response.json`
and `.summary.txt` are one recorded evidence-expert run (partial: 3 of 12
numbers, each with a population warning). Show them as a file, not in the app.
Their 47 % and 18 % are base rates in other study populations (all ED dyspnoea;
acute respiratory failure), not this patient's probability. Do not type them in
as findings.

## What the demo does not show

- Clinical accuracy or calibrated probabilities.
- Positive coding assignment is not guaranteed: suspected hypotheses are not
  coded as confirmed, and the coding adapter is temporary.
- The standalone `evidence-gathering-expert/` module is not wired into the app.
