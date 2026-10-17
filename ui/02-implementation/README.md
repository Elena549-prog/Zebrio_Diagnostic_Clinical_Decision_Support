# 02 · Implementation

Decided, buildable design. Every file here maps to code in `web/src/` (and,
where the domain changes, `server/domain/types.ts` — the source of truth for
types).

| Subfolder | Contents |
|---|---|
| `PRD-arbor-clinician-ui.md` | The product requirements for the clinician UI (requirements, milestones, design decision D-1). |
| `flows/` | End-to-end user flows. Start with [`gp-pediatric-user-flow.md`](flows/gp-pediatric-user-flow.md). |
| `screens/` | One spec per screen/state: layout, content, states, which flow step it serves. |
| `components/` | One spec per component (tree node, evidence card, decision panel…): props, states, interactions, motion. |
| `tokens/` | Design tokens: colour, type scale, spacing, motion timings. Will feed `web/src/styles.css`. |

## Conventions for specs

- Use the domain words from `CONTEXT.md` (Presentation, Hypothesis, Finding,
  Round, Working diagnosis, Reasoning trail…).
- Every spec names **what the agent proposes** and **what the doctor
  decides**. The agent never orders a test or locks a diagnosis.
- Ruled-out branches stay visible. No spec may delete them from the tree.
- Link to the design-library sources the spec was derived from.
