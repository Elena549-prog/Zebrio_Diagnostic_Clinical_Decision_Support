# Arbor UI workspace

Two folders, two jobs:

| Folder | What goes in | Who reads it |
|---|---|---|
| [`01-design-library/`](01-design-library/) | Raw material: inspiration, typefaces, UI references, micro-animations, interactions, ideas. Drop files here freely. | Designers, anyone exploring |
| [`02-implementation/`](02-implementation/) | Decided things: the user flow, screen specs, component specs, design tokens. Each file here should be buildable. | Designers + developers + AI agents |

**The rule of the line:** material moves from `01` to `02` only once it is a
decision. When an idea in `01-design-library/ideas/` is accepted, write it up
in `02-implementation/` and link back to the source file.

Start here:
- **PRD:** [`02-implementation/PRD-arbor-clinician-ui.md`](02-implementation/PRD-arbor-clinician-ui.md)
- **User flow:** [`02-implementation/flows/gp-pediatric-user-flow.md`](02-implementation/flows/gp-pediatric-user-flow.md)
- **Visual languages A & B:** [`01-design-library/visual-languages/`](01-design-library/visual-languages/README.md) (open each `specimen.html` in a browser)

The running app lives in `web/src/` — `02-implementation/` describes *what* to
build there; it is not a second codebase.
