# Interaction patterns

Behaviours observed on the reference sites (2026-10-17) and how each maps to
the reasoning tree and the doctor's decisions. Live demos are in each
specimen's "Interaction" section.

| # | Pattern | Seen on | Arbor use | Language |
|---|---|---|---|---|
| 1 | **Hover a token → the input lights up by relevance** (blue +, red −) | attnlrp-demo | Hover a hypothesis → findings tint for/against; hover a finding → the tree tints. Click holds. Keyboard focus does the same. | A (hero), B (with drifting edge) |
| 2 | **Prediction timeline** (bar per generated token, scrubbable) | attnlrp-demo | The round/visit scrubber (`Timeline.tsx`): one bar per round, its height = how much the differential changed | A, B |
| 3 | **Ring gauges** ("41 · Medium context grounding") | attnlrp-demo | Leading-hypothesis confidence; "evidence coverage" (how many findings are explained) | A |
| 4 | **Steering slider** (grounding α −/+) | attnlrp-demo | *Not adopted*: the doctor should not "steer" probabilities directly (see the open question in the flow doc). Possible later use: a what-if slider ("if this test were positive…") | — |
| 5 | **Preset dropdown** ("Grounded Scenario") | attnlrp-demo | Scenario / case picker; the Guided tour | A |
| 6 | **Sticky "Sections" TOC** | manipulation | The reasoning trail and referral summary as a long document with a sticky outline | A, B (rail) |
| 7 | **Segmented control + "Replay attack"** inside a figure | manipulation | Tree / Ranked / Trail switch + **Replay case** (animate rounds in order) | A, B |
| 8 | **Trusted / untrusted source labels** (mono, green/orange) | manipulation | Finding provenance: *lab-verified* vs *parent-reported* vs *agent-literature* | A, B |
| 9 | **`demo-hint` pulsing ring** on the next clickable thing | manipulation | Points to the HITL gate when the engine is waiting | A |
| 10 | **Human / Agent toggle** | supermemory | Filter the trail: clinician decisions · agent proposals · both | B (hero), A |
| 11 | **Copy setup prompt** (hatch button, "COPIED" swap) | supermemory | Copy the referral letter / safety-net text into the practice system | B |
| 12 | **Left rail + scroll-spy** | supermemory | Workspace sections that follow the flow steps 1–5 | B |
| 13 | **CTA rail sweep + icon tile spin** | supermemory | The primary action has weight: *Run next round*, *Confirm* | B |
| 14 | **Toasts that swipe out** (Sonner) | attnlrp-demo | Non-blocking confirmations: "Finding added", "Case parked" | A, B |

## Interaction rules for the tree

- **Hover previews, click commits.** Hover never changes state, it only highlights.
- **Every state-changing action on a node asks for intent** (rule out → a reason; confirm → a guard if a must-not-miss node is still live).
- **Keyboard parity:** Tab through nodes, Enter opens, `P` pins, `X` rules out (with confirmation), `Esc` releases a held highlight.
- **The agent's proposals are visually distinct** (outlined / "proposed" stamp) until the doctor accepts them.
