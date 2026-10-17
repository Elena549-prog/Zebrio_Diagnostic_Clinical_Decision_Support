# PRD: Arbor clinician UI (GP & pediatrics)

| | |
|---|---|
| **Status** | Draft v0.1, for review |
| **Date** | 2026-10-17 |
| **Owner** | Product / UX (Fraunhofer HHI) |
| **Builds on** | [User flow](flows/gp-pediatric-user-flow.md) · [Visual languages](../01-design-library/visual-languages/README.md) · `CONTEXT.md` · `docs/recipes/` · ADR 0001 & 0002 |
| **Codebase** | `web/src/` (React + Vite), `server/` (Express, Corti Agent API) |

---

## 1. Summary

Arbor is a retraceable differential-diagnosis assistant. This PRD defines the
**clinician-facing UI** that lets a GP or pediatrician work a patient case from
presentation to a diagnostic decision and follow-up. The UI is built around a
**reasoning tree** that is always on screen. The doctor can navigate it,
interrogate it, and change it. The agent proposes; the doctor decides at every
step, using their own clinical judgment.

The current prototype proves the engine (rounds, branching, zebras, HITL test
gate, working diagnosis, treatment plan). This release turns it into a
workflow that fits primary care:
- the doctor acts directly on the tree
- four decision outcomes, not one
- cases can be paused for days and resumed
- follow-up visits continue the same tree

## 2. Problem

1. **Primary-care diagnosis is open-ended and spread over time.** Symptoms are
   undifferentiated, results arrive days later, and "watch and review" is often
   the right call. The prototype assumes one sitting that ends in a confirmed
   diagnosis.
2. **The doctor's judgment has nowhere to go.** Today the clinician can only
   enter findings and press "advance". They cannot add a hypothesis, pin a
   must-not-miss, rule something out with a reason, or reject an agent
   proposal. Their judgment is invisible, so the reasoning trail is
   incomplete.
3. **Explainability is buried.** The evidence for and against each hypothesis
   exists in the data (`evidenceFor/Against`) but is shown in a side panel, not
   where the doctor looks: on the tree.
4. **Pediatrics needs its own context:** age in months, parent as historian,
   weight, vaccinations, and lower thresholds for red flags.

## 3. Users

| Persona | Context | Needs from Arbor |
|---|---|---|
| **GP**, e.g. "Dr. Weber", 12 years in a group practice | 10–15 min consults, undifferentiated symptoms, multimorbid adults, results come back in 1–3 days | Speed; not missing the dangerous diagnosis; a defensible note; safe "wait and see" |
| **Pediatrician**, e.g. "Dr. Okafor", outpatient | Febrile children, a parent gives the history, high anxiety, a small error margin in infants | Age-aware priors, red-flag vigilance, clear safety-netting text for parents |
| Secondary: **trainee / supervisor** | Teaching and case review | Replay how a conclusion was reached |
| Secondary: **specialist receiving a referral** | Reads the output, not the app | A concise summary of what was considered and ruled out |

Main environment: a desktop browser in the consult room (1280–1920px), often
next to the practice EHR. Tablet use is secondary. Keyboard use is common.

## 4. Goals, non-goals, success metrics

### Goals
- **G1:** The doctor can take every decision in the flow (add, pin, rule out, choose a test, decide, re-open) **on the tree**, and each one is recorded with its author.
- **G2:** All five flow steps are supported, including the non-confirm outcomes (refer, investigate, unresolved) and longitudinal follow-up.
- **G3:** Explainability on hover: for any hypothesis, the evidence for and against is visible in ≤ 1 interaction.
- **G4:** A pediatric case can be entered and reasoned with age in months and the pediatric context.
- **G5:** One coherent visual language (chosen from A or B, or a hybrid), implemented as tokens.

### Non-goals (this release)
- Integration with a real EHR / PVS or e-prescribing (copy and export only)
- Autonomous test ordering or auto-locked diagnoses (out by design; see AGENTS.md)
- Direct numeric editing of probabilities (open question §13)
- Mobile phone layout
- A new engine model or faster rounds (round latency is the model's reasoning time)
- Certification as a medical device. Arbor stays a research demo with its disclaimer.

### Success metrics (usability study, n ≈ 8–12 GPs/pediatricians, scripted cases)
| Metric | Target |
|---|---|
| Task success: reach a decision (any of the 4) on a scripted case without help | ≥ 90% |
| Time from opening the case to the first round started | ≤ 90 s |
| Doctors who use at least one tree action (pin / rule out / add) unprompted | ≥ 70% |
| Can explain why the leading hypothesis leads, using only the UI | ≥ 80% |
| SUS score | ≥ 75 |
| Must-not-miss diagnosis still visible at decision time (scripted zebra case) | 100% |
| Perceived trust ("I could defend this decision"), 1–7 | ≥ 5.5 |

## 5. Product principles

1. **The agent proposes, the doctor disposes.** Agent output is a proposal until the doctor accepts it. Nothing clinical is committed without a clinician action.
2. **Retraceable by default.** Nothing is deleted. Ruled-out branches dim and stay; every change has an author, a time and a reason.
3. **Horses lead, zebras stay.** Common diagnoses rank by base rate, while rare and dangerous ones remain visible until ruled out with a reason.
4. **"Not yet" is an answer.** Refer, investigate further, and remain unresolved are first-class outcomes.
5. **Explain on demand, calm by default.** The tree is quiet at rest; hover or focus shows the attribution.
6. **Respect the consult.** No animation or loading state blocks the doctor; long rounds run in the background.

## 6. Information architecture

```
Case list (home)
 ├─ New case → Intake (Step 1)
 └─ Open case → Workspace
      ├─ Left rail: flow steps 1–5 with status (scroll-spy) + Next-action card
      ├─ Centre: Reasoning tree (default) ⇄ Ranked list ⇄ Trail  [segmented]
      ├─ Right: Detail panel (selected node: evidence, base rate, codes, tests, actions)
      ├─ Bottom: Timeline scrubber (rounds + visits) with Replay
      └─ Overlays: Assessment entry · Round review (diff) · Decision panel · Outputs (referral / safety-net / plan)
```

| Screen / surface | Flow step | Exists today | Change |
|---|---|---|---|
| Case list (status groups, review dates) | 5 | `Home.tsx` (scenario cards) | **New:** list of cases by status |
| Intake form + pediatric block | 1 | Blank case only | **New** |
| Workspace shell | all | `App.tsx`, `AppShell.tsx` | Restructure to rail + canvas + detail |
| Next-action card | gate | `NextAction.tsx` | Extend: park, go to decision |
| Assessment entry (exam / lab / imaging lanes) | 2 | inline finding form | **New** structured lanes |
| Reasoning tree | 3 | `DecisionTree.tsx` | Node actions, attribution hover, proposals, test diamonds |
| Ranked list | 3 | `RankedDifferential.tsx` | Same actions as the tree |
| Detail panel | 3 | `DetailPanel.tsx` | For/against columns, actions, gaps |
| Round review (diff) | 3d | `timeTravel.ts › describeDiff` | **New** accept / reject step |
| Missing-information list | 3c | — | **New** |
| Decision panel (4 outcomes) | 4 | "Set working dx" | **New** |
| Outputs: referral, safety-net, treatment | 4 | `treatment.ts` (plan only) | **New** referral + safety-net |
| Timeline + Replay | 5 | `Timeline.tsx` | Add visits; Replay |
| Trail view (audit, filter human/agent) | all | `FindingsView.tsx` partly | **New** view |

## 7. Functional requirements

Priority: **P0** = required for this release · **P1** = should · **P2** = could.

### 7.1 Case list & lifecycle
| ID | Requirement | Pri |
|---|---|---|
| FR-0.1 | The home page lists cases grouped by status: *In progress · Awaiting results · Monitoring · Referred · Treated · Closed*, each showing the patient label, age, chief complaint, leading hypothesis and review date. | P0 |
| FR-0.2 | Cases with a review date due today or overdue are flagged at the top. | P1 |
| FR-0.3 | The Guided tour and demo scenarios stay reachable from the home page. | P0 |
| FR-0.4 | Cases persist across server restarts (today the store is in-memory). | P1 |

### 7.2 Step 1: Presentation
| ID | Requirement | Pri |
|---|---|---|
| FR-1.1 | Structured intake: chief complaint, HPI, previous diagnoses (each *active/resolved*), medications, allergies, demographics. | P0 |
| FR-1.2 | Age is entered in years, or in **months under 2 years** (weeks under 3 months); priors use that age band. | P0 |
| FR-1.3 | The pediatric block appears when age < 18: historian (parent/guardian/child), weight, vaccination status, birth history, development concerns, sick contacts. | P0 |
| FR-1.4 | Free-text or dictated note → fields extracted by the intake agent; each extracted field is marked "proposed" until the doctor accepts it. | P1 |
| FR-1.5 | Red flags found in the history are highlighted with a reason; the doctor can dismiss one with a reason. | P1 |
| FR-1.6 | Before the first round, the doctor confirms the base-rate context ("Priors for: 14-month-old, Berlin"). | P0 |

### 7.3 Step 2: Clinical assessment
| ID | Requirement | Pri |
|---|---|---|
| FR-2.1 | Three entry lanes (Examination · Laboratory · Imaging) create Findings with `source` exam / lab / imaging. | P0 |
| FR-2.2 | Each finding has a state: *pending · normal · abnormal*. Pending findings are not used as evidence. | P0 |
| FR-2.3 | Vitals are checked against age-adjusted ranges and flagged; the doctor can dismiss a flag. | P1 |
| FR-2.4 | The agent proposes the direction of each finding per hypothesis (supports / against / neutral); the doctor accepts or changes it. | P0 |
| FR-2.5 | Provenance label on each finding: clinician-observed · lab-verified · parent-reported · literature. | P1 |

### 7.4 Step 3: Diagnostic reasoning (the tree)
| ID | Requirement | Pri |
|---|---|---|
| FR-3.1 | **Generate:** running a round shows the differential on the tree with probability, horse/zebra marking and a base-rate note per node. | P0 (exists) |
| FR-3.2 | **Add hypothesis:** the doctor can add a top-level or child hypothesis; it is marked *clinician-added*, and the engine must rank it next round. | P0 |
| FR-3.3 | **Pin must-not-miss:** the doctor pins a node with a reason. A pinned node can't be ruled out by an agent proposal alone. | P0 |
| FR-3.4 | **Rule out:** requires a one-line reason. The node dims and stays, and can be restored. | P0 |
| FR-3.5 | **Disagree with weight:** the doctor marks a node "likely higher/lower", with an optional reason that is passed to the next round. | P1 |
| FR-3.6 | **Compare evidence:** the selected node shows For / Against columns with weights and citations. Findings that bear on no live hypothesis are listed as *unexplained*. | P0 |
| FR-3.7 | **Attribution on hover:** hovering or focusing a node tints the findings for/against; hovering a finding tints the nodes. Click holds the highlight; Esc releases it. | P0 |
| FR-3.8 | **Missing information:** after each round, a list of gaps (question / exam / test), each naming which hypotheses it would separate, ranked by information gain. | P0 |
| FR-3.9 | For each gap the doctor can: ask/examine now · order test · choose a different test · mark "not available / not appropriate" with a reason (the agent must propose an alternative). | P0 |
| FR-3.10 | Proposed tests are drawn on the tree between the nodes they discriminate. | P1 |
| FR-3.11 | **Round review:** after a round, a diff (↑/↓ probabilities, new branches, proposed rule-outs) is shown. The doctor accepts all, or rejects individual changes. | P0 |
| FR-3.12 | Agent proposals not yet accepted are visually distinct (outlined, "proposed" stamp). | P0 |
| FR-3.13 | Every tree change carries an author (agent / clinician), a time, a round, and a reason where one is required. | P0 |
| FR-3.14 | Views: Tree ⇄ Ranked list ⇄ Trail, with the same actions available in Tree and Ranked list. | P0 |
| FR-3.15 | While a round runs (1–3 min), the doctor can keep entering findings, browse and read. Progress shows on the active edge, and the doctor is notified when the round completes. | P0 |

### 7.5 The gate
| ID | Requirement | Pri |
|---|---|---|
| FR-G.1 | The Next-action card always shows exactly one primary action plus alternatives: *Add finding & run round · Order test & park · Go to decision*. | P0 |
| FR-G.2 | *Go to decision* is available at any time, not only when the engine reports "converged". | P0 |
| FR-G.3 | *Park* sets the status to *Awaiting results* with the ordered tests listed; the case appears on the case list. | P0 |

### 7.6 Step 4: Diagnostic decision
| ID | Requirement | Pri |
|---|---|---|
| FR-4.1 | A decision panel with four outcomes: **Confirm · Refer · Investigate further · Remain unresolved**. The agent's recommendation is preselected, and the doctor may pick any outcome and any live node. | P0 |
| FR-4.2 | **Confirm:** choose the node and confidence, add a note → working diagnosis, the path from the root highlighted, then the treatment plan. | P0 |
| FR-4.3 | **Guard:** confirming while a pinned must-not-miss is still live requires a one-line justification. | P0 |
| FR-4.4 | **Refer:** specialty, urgency (routine/urgent/emergency), question → a generated referral summary (presentation, findings, differential, what was ruled out and why, open questions), copyable. | P0 |
| FR-4.5 | **Investigate further:** pick the tests → the case is parked as *Awaiting results*. | P0 |
| FR-4.6 | **Remain unresolved:** a review date (required) and safety-net points → plain-language advice for the patient/parent, copyable; status *Monitoring*. | P0 |
| FR-4.7 | The decision and its rationale are written to the reasoning trail. | P0 |

### 7.7 Step 5: Follow-up
| ID | Requirement | Pri |
|---|---|---|
| FR-5.1 | Re-opening a case starts a new **visit (encounter)**. The tree is restored and the scrubber shows a visit marker. | P0 |
| FR-5.2 | New findings in a visit restart the loop at Step 2 on the same tree. | P0 |
| FR-5.3 | **Re-open differential:** a confirmed diagnosis can be returned to live with a reason. | P0 |
| FR-5.4 | **Replay:** animate the case round by round across visits. | P1 |
| FR-5.5 | Trail view filter: *clinician decisions · agent proposals · both*. | P1 |
| FR-5.6 | Export the trail as a printable/PDF summary. | P2 |

### 7.8 Ask the engine
| ID | Requirement | Pri |
|---|---|---|
| FR-6.1 | Free-text Q&A about the case remains (`ChatPanel.tsx`) and can reference a node ("why is UTI still at 12%?"). | P1 |
| FR-6.2 | Answers stream in token by token. | P2 |

## 8. Reasoning tree specification

**Node anatomy:** name (sentence case, never truncated without a tooltip) ·
probability (mono, tabular) · status · markers (zebra, must-not-miss pin,
proposed, clinician-added) · for/against counts · an author dot.

| State | Visual requirement (both languages) |
|---|---|
| Live | Full ink, surface fill |
| Proposed (not yet accepted) | Outlined / "proposed" stamp |
| Branched | Parent stays visible; children connected |
| Confirmed | Primary/blue emphasis; the path from the root is highlighted |
| Ruled out | Dimmed **and** struck through / labelled; stays in place |
| Zebra | A marker plus a text label, not colour alone |
| Must-not-miss | Pin marker plus a frame; can't be auto-ruled out |
| Selected / focused | Ring; edges to the root highlighted |
| Attribution (hover) | Fill tints for/against with glyphs ▲/▼ or +/− |

**Behaviour**
- Layout: left-to-right tidy tree (existing `tidyLayout`); user pins and pan/zoom are kept (existing).
- Readable at 25 live + 25 ruled-out nodes without overlap; collapse ruled-out subtrees on demand.
- Hover previews; click selects; actions live in the detail panel and in the node's context menu.
- Keyboard: Tab/arrow navigation, Enter opens, `P` pin, `X` rule out (with confirmation), `A` add child, `Esc` release.
- Every animation follows the motion rules in [`microanimations/README.md`](../01-design-library/microanimations/README.md).

## 9. Visual & interaction design

Two candidate languages are fully specified, with tokens, specimens and buttons:

| | A · Attribution | B · Ledger |
|---|---|---|
| Spec | [A README](../01-design-library/visual-languages/A-attribution/README.md) | [B README](../01-design-library/visual-languages/B-ledger/README.md) |
| Fonts | Noto Serif · Open Sans · Space Grotesk · Roboto Mono | Geist · Geist Mono |
| Action | `#0068CF` | `#0562EF` |
| For / against | `#60A5FA` / `#F87171` heat | `#0562EF` / `#A02B25` |
| Signature | Hover-to-attribute heatmap | Ledger rows, mono stamps, draw-across |

**Decision D-1 (needed by M0):** choose A, B, or the hybrid (B's structure
and stamps with A's attribution heat). Recommendation: test the hybrid and
pure B in a quick preference study with 3–5 clinicians, using the specimens.

**Requirements independent of the choice**
- DS-1: Implement the chosen language as CSS variables in `web/src/styles.css` (replacing ad-hoc colours), copied from the chosen `tokens.css`.
- DS-2: Component inventory: Button (primary/secondary/ghost/destructive/icon), Segmented, Tag/Stamp, Decision card/row, Finding row, Tree node, Probability bar, Diff row, Gap item, Toast, Rail section, Scrubber.
- DS-3: Apply the accessibility adjustments listed in each language README (several extracted label colours fail AA).
- DS-4: Fonts are self-hosted (`web/public/fonts`) for privacy (no Google Fonts call from a clinical page).

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Accessibility | WCAG 2.2 AA: contrast ≥ 4.5:1 for text; never colour-only meaning; full keyboard path through all five steps; visible focus; `prefers-reduced-motion` honoured; the tree has an accessible list equivalent (the Ranked view). |
| Performance | UI response ≤ 100ms for local actions; the tree renders 50 nodes at 60fps during pan/zoom; round latency (1–3 min, model-bound) never blocks input. |
| Resilience | Keep the `sendMessageReliable` + stale-agent recreation path; a failed round shows a retry without losing entered findings. |
| Language | EN and DE UI strings; medical terms are not machine-translated in the UI. |
| Privacy | No patient identifiers in URLs; demo/test data only; no third-party font/CDN calls in production. |
| Safety | Persistent "decision support, not a medical device" disclaimer; no autonomous orders or verdicts; must-not-miss guard (FR-4.3). |
| Auditability | Every clinical state change is an event with author, time and reason (FR-3.13); events are append-only. |
| Browsers | Latest Chrome, Edge, Firefox, Safari; desktop ≥ 1280px primary; tablet ≥ 768px usable. |

## 11. Dependencies (server & domain)

From [the user flow §5](flows/gp-pediatric-user-flow.md). Server types first,
then mirrored in `web/src/types.ts`:

- `Presentation.pastDiagnoses`, `medications`, `allergies`; `Demographics.ageMonths`, `pediatric{…}`
- `FindingSource += "imaging"`; `Finding.state`
- `Hypothesis.author`, `pinned`, `ruledOutReason`, `clinicianWeightNote`
- `CaseStatus += awaiting_results | referred | monitoring`; `Case.decision`; `Case.encounters`; `HistoryEntry.encounterId`
- Engine contract: `missing[]` gap list; must respect clinician pins/additions/weight notes in its prompt
- Endpoints: `POST /cases/:id/hypotheses`, `PATCH /cases/:id/hypotheses/:hid`, `POST /cases/:id/decision`, `POST /cases/:id/encounters`, case-store persistence
- Guided tour (`tutorialCase.ts`) updated so every new feature can be demoed without the API

## 12. Milestones

| Milestone | Content | Exit criteria |
|---|---|---|
| **M0 · Design decision** | Pick the language (D-1); tokens into `styles.css`; component specs in `02-implementation/components/` | Tokens merged; specimens signed off |
| **M1 · Doctor on the tree** | FR-3.2–3.4, 3.7, 3.12–3.14; author field; endpoints | Add / pin / rule out / restore work end-to-end with trail entries |
| **M2 · Decide** | FR-G.*, FR-4.* (four outcomes, guard, referral & safety-net output) | All four decisions reachable in the Guided tour and live |
| **M3 · Reason better** | FR-3.6, 3.8–3.11, 3.15 (gaps, round review, background rounds) | Engine returns `missing`; diff accept/reject |
| **M4 · Pediatrics & intake** | FR-1.*, FR-2.* | A pediatric scripted case runs with months-based priors |
| **M5 · Longitudinal** | FR-0.*, FR-5.* (case list, park, visits, reopen, replay) | A two-visit case replays end-to-end |
| **M6 · Validate** | Usability study against §4 metrics; accessibility audit | Targets met or follow-ups filed |

## 13. Risks & open questions

| Risk / question | Mitigation / owner |
|---|---|
| Doctors over-trust the agent (automation bias) | Proposals are visibly "proposed"; acceptance is explicit; must-not-miss guard; evidence is shown before the decision |
| Rounds are slow (1–3 min) and break the consult | Background rounds (FR-3.15), notifications, the case keeps working |
| Engine ignores clinician pins and additions | Server-side enforcement: pinned nodes can't be dropped by merge; prompt contract tests |
| Blue/red distinguishability for colour-vision deficiency | Glyphs ▲/▼ and +/− on every tinted element (both languages) |
| Should doctors edit probabilities directly? | Draft says nudges only (FR-3.5). Decide with clinical advisors |
| Which pediatric red-flag framework (e.g. NICE NG143)? | Needs clinical sign-off before FR-1.5 / FR-2.3 |
| Referral output format (copy text, PDF, PVS export)? | Start with copy + print (P0), export later |
| Persistence and data protection for real use | Out of scope for the demo; flag before any pilot |
| Visual language A vs B vs hybrid | Decision D-1 at M0 |

## Appendix: traceability

| Flow step ([user flow](flows/gp-pediatric-user-flow.md)) | Requirements |
|---|---|
| 1 Presentation | FR-1.1–1.6 |
| 2 Assessment | FR-2.1–2.5 |
| 3a Generate | FR-3.1–3.4, 3.12 |
| 3b Compare | FR-3.5–3.7 |
| 3c Missing info | FR-3.8–3.10 |
| 3d Revise | FR-3.11, 3.13 |
| Gate | FR-G.1–G.3, FR-3.15 |
| 4 Decision | FR-4.1–4.7 |
| 5 Follow-up | FR-0.1–0.4, FR-5.1–5.6 |
