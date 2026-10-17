# Micro-animations

A catalog of the motion patterns found on the reference sites (2026-10-17),
mapped to Arbor moments. Live, replayable versions are in the specimens:
[A](../visual-languages/A-attribution/specimen.html) · [B](../visual-languages/B-ledger/specimen.html#motion).
Drop GIF/MP4/Lottie references here using the naming rule in the folder README.

## Arbor moment → animation

| Arbor moment | A · Attribution | B · Ledger | Duration budget |
|---|---|---|---|
| Engine message arrives | `a-fade-in-token`: words fade up .1em, 18ms stagger | `b-rise-in`: 8px rise, 80ms row stagger | ≤ 400ms + stagger |
| Differential re-ranks | bar width, `cubic-bezier(0,0,.2,1)` 700ms | bar width on `--spring-36` 580ms | ≤ 700ms |
| Finding lands on a hypothesis | chip flies to the node + `a-plop` (0→.7→.2) | row `b-rise-in` + node outline tints | ≤ 600ms |
| Hypothesis branches | stroke-dashoffset draw 700ms, children +450ms | `b-draw-across` clip-path 500ms, children +300/+80ms | ≤ 800ms total |
| Hypothesis ruled out | dim to .4 + grayscale 400ms | strike-through sweep 400ms → ink-60 | 400ms |
| Engine is reasoning | spinner `a-spin` (720°/1.4s) in the primary button | edge `b-drift` dashes + `b-shimmer` label | loop |
| Waiting for the doctor (HITL) | `a-hint` inset green ring pulse 2s | `b-live-pulse` green dot 2s | loop, stops on focus |
| Citation revealed | highlight sweep (background-size) 600ms | gradient underline slide 400ms | ≤ 600ms |
| Path to the selected node | `a-trace-flow` dash loop | `b-drift` on the active edge | loop while selected |
| Decision selected | 2px primary ring | 2px underline draws across, 300ms ease-out | ≤ 300ms |
| Primary button hover | bg darken + soft shadow 150ms | rail sweep 360ms + tile spin (spring) | ≤ 360ms |
| Press | scale .97 | scale .985 120ms | ≤ 150ms |

## Easing library (copied from the sources)

| Name | Curve | Source | Use |
|---|---|---|---|
| standard | `cubic-bezier(.4,0,.2,1)` | Tailwind on all three sites | Most UI state changes |
| reveal | `cubic-bezier(0,0,.2,1)` | layerwise reveals | Things appearing |
| ease-out | `cubic-bezier(.22,1,.36,1)` | supermemory | Draw-across, underlines |
| hover | `cubic-bezier(.25,.1,.25,1)` | supermemory | Colour changes |
| cta | `cubic-bezier(.23,1,.32,1)` | supermemory | Button rail and press |
| enter | `cubic-bezier(.2,0,0,1)` | supermemory | Toasts, popovers |
| spring-36 | `linear(0, .0791, .2369, …, 1)` (full value in `B-ledger/tokens.css`) | supermemory | Settles: bars, tile spin |

## Rules for clinical motion

1. **Motion explains a change in reasoning; it never decorates.** Each animation answers "what just changed in the differential?"
2. **No animation delays a clinical action.** Buttons respond in ≤ 150ms; reveals never block input.
3. **Loops only for waiting states**, and they stop once the doctor engages.
4. **Ruled-out nodes never animate away.** They dim or strike, and stay.
5. **`prefers-reduced-motion` is respected** (the tokens files set durations to 1ms).
