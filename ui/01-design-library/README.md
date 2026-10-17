# 01 · Design library

The upload folder. Drop anything that inspires or informs the Arbor UI. Nothing
here is a commitment.

| Subfolder | Put here | Examples |
|---|---|---|
| `inspiration/` | Moodboards, screenshots of products you admire, clinical tools, editorial layouts | EHR screenshots, Linear, Figma canvases, medical journals |
| `typeface/` | Font files, specimens, pairing tests, licence notes | `.woff2`, specimen PDFs, `licence.txt` |
| `ui-references/` | Specific UI patterns to reuse: trees, timelines, evidence cards, forms | Node-link trees, diff views, triage cards |
| `microanimations/` | Short motion references (GIF/MP4/Lottie) and timing notes | Node branching, probability bar re-rank, gate pulse |
| `interactions/` | How something *behaves*: drag, scrub, expand, confirm | Time-travel scrubber, pin/rule-out gestures |
| `ideas/` | Written ideas, sketches, open questions | Use [`_template.md`](ideas/_template.md) |
| `visual-languages/` | Complete candidate design languages: tokens, specimen page, spec | [A · Attribution](visual-languages/A-attribution/), [B · Ledger](visual-languages/B-ledger/) |

## What's here now (2026-10-17)

- **Two visual languages** extracted from Layerwise and Supermemory: [`visual-languages/README.md`](visual-languages/README.md) compares them. Open each `specimen.html` in a browser.
- Fonts: [`typeface/README.md`](typeface/README.md) · Motion: [`microanimations/README.md`](microanimations/README.md) · Behaviour: [`interactions/README.md`](interactions/README.md)
- Raw extracted values: [`ui-references/2026-10-17_extracted-values_layerwise-supermemory.md`](ui-references/2026-10-17_extracted-values_layerwise-supermemory.md)
- Screenshots: `inspiration/2026-10-17_*.jpg` (low-res captures)

## Naming

`YYYY-MM-DD_short-name_source.ext` — e.g. `2026-10-17_tree-collapse_observable.mp4`.
Add a sidecar `.md` with the same name when the *why* is not obvious from the
file.

## Promoting to implementation

When something here is accepted, write the decision in `../02-implementation/`
and link back to the file here. Leave the original in place.
