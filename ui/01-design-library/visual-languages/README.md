# Visual languages

Two candidate visual languages for the Arbor clinician UI, each extracted
from a real reference site (2026-10-17) and translated into Arbor's semantics:
hypotheses, evidence for/against, zebras, must-not-miss, ruled-out, and
agent vs clinician authorship.

| | **A · Attribution** | **B · Ledger** |
|---|---|---|
| Source | Layerwise: AttnLRP demo + manipulation article | Supermemory home |
| One line | Warm, editorial, explainable | Precise, auditable, technical |
| Display font | Noto Serif | Geist |
| UI font | Open Sans (+ Space Grotesk labels) | Geist (+ Geist Mono CAPS labels) |
| Page / ink | `#F5F5F5` / `#1E130F` (warm) | `#F4F4F6` / `#0B1015` (cool) |
| Action blue | `#0068CF` | `#0562EF` |
| Evidence for / against | heat `#60A5FA` / `#F87171` | blue `#0562EF` / alert `#A02B25` |
| Zebra | violet dot `#A78BFA` | hatch texture |
| Corners | 16px cards, pill buttons | Square (0–4px) |
| Depth | Flat; soft shadow on hover | Hairline rules; float shadow only for popovers |
| Motion signature | Token fade-in, *plop*, highlight sweep | Rail sweep + tile spin, draw-across, spring settle, drift |
| Hero interaction | Hover to attribute (heatmap) | Trace node → evidence with drifting edge |
| Dark mode | Yes (from source) | Not published; would need design |
| Feels like | A calm colleague explaining | A rigorous record you can defend |

## Open each specimen

Open `A-attribution/specimen.html` or `B-ledger/specimen.html` in a browser
(double-click works; fonts load from Google Fonts). Each specimen covers the
palette with hex values, the type scale, every button and its states, the tags,
six micro-animations with **Replay**, and an interactive reasoning-tree demo.

## How to choose

Pick by what the doctor must feel at the moment of decision:
- When **"I understand why the agent thinks this"** matters most, choose **A**. The heatmap is the most direct visual answer to "what supports what".
- When **"I can defend this decision later"** matters most, choose **B**. The ledger look makes the reasoning trail feel like a signed record.

A hybrid is possible: B's structure (rail, rules, mono stamps, decision ledger)
with A's attribution heat on hover. The PRD
(`../../02-implementation/PRD-arbor-clinician-ui.md`) lists this as an open decision.

Both READMEs end with **accessibility adjustments**. A few extracted label
colours fail WCAG AA and must be darkened for clinical use.
