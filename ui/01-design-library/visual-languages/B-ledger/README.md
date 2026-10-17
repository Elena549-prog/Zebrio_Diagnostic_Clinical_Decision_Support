# Visual language B — "Ledger"

> A precise, auditable surface: ink on paper, one decisive blue. Every
> hypothesis reads like a ledger entry: dated, attributed, never erased.

- **Derived from:** [supermemory.ai](https://supermemory.ai), extracted 2026-10-17
- **Files:** [`tokens.css`](tokens.css) (CSS variables + keyframes, including the source's `linear()` spring) · [`specimen.html`](specimen.html)
- **Raw values:** [`../../ui-references/2026-10-17_extracted-values_layerwise-supermemory.md`](../../ui-references/2026-10-17_extracted-values_layerwise-supermemory.md)
- **Screenshot:** `../../inspiration/2026-10-17_home-hero_supermemory.jpg`

## Personality

| Feels | Because |
|---|---|
| Rigorous, auditable | Square corners, hairline rules, monospace labels, numbered sections |
| Technical, high-signal | One saturated blue (`#0562EF`); everything else is ink at fixed alphas |
| Crafted | Precise motion: a sweep rail, a spinning icon tile, a draw-across, and a spring settle |
| Printed record | Paper `#F4F4F6`, hatch and dot-grid textures, a 208px rail + 640px column |

**Best for:** when the **reasoning trail and its audit** are the hero. It also
suits dense desktop use by a GP between patients: compact, scannable, every
state shown as a "stamp".

## Typography

| Role | Font | Spec |
|---|---|---|
| Statement | **Geist** 400 | 40 / 1.12, −3% |
| H2 | Geist 400 | 24 / 30, −2% |
| H3 | Geist 500 | 16 / 1.3, −1% |
| Body | Geist 400 | 17 / 1.65 (measure 600px) |
| UI | Geist 400 | 13–15 |
| Labels, buttons, tags | **Geist Mono** 500 UPPERCASE | 11–12px, +6% |
| Data, codes, percentages | Geist Mono 400 | 12; zero-padded (`03%`) |

Geist and Geist Mono (Vercel) are OFL and on Google Fonts. The source
self-hosts both as variable woff2. See [`../../typeface/`](../../typeface/).

## Colour (hex)

**Neutrals:** paper `#F4F4F6` · surface `#FFFFFF` · warm `#FAFAFA` · rule `#DFDFDF` · ink `#0B1015`, used at fixed alphas: 86% `#0B1015DB`, 68% `#0B1015AD`, 60% `#0B101599`, 45% `#0B101573`, 40% `#0B101566` · logo ink `#141B34`

**Blue scale:** 7% `#0562EF12` · 11% `#0562EF1C` · 40% `#0562EF66` · tick `#9EC6F7` · **blue `#0562EF`** · deep `#0450C8` · link-start `#0042AF` · press `#033A9A` · on-blue `#FFFBF5`

**Signals:** live `#00C763` · success `#10A86A` · alert `#A02B25` (the one red on the site)

**Arbor semantics:** evidence for = blue · against = alert `#A02B25` · confirmed = blue fill · ruled out = ink-40 + strike · **zebra = hatch texture** · **must-not-miss = solid ink frame** · live = green dot

No dark theme was published by the source; one would need to be designed.

## Buttons

| Variant | Spec | Arbor use |
|---|---|---|
| **Primary** | 44h · square · `#0562EF` · Geist Mono 12/500 +6% CAPS in `#FFFBF5` · a 40px icon **tile** flush left | *Run next round*, *Confirm* |
| ↳ hover | a deep-blue rail sweeps in (360ms `cubic-bezier(.23,1,.32,1)`); the frame insets 2px; the tile **rotates 360°** on spring-36 | |
| ↳ press | scale .985 · 120ms · `#033A9A` | |
| Secondary | white · 1px inset `#0562EF66` · ↗ nudges +2/−2px on hover | *Order test & park*, *Refer ↗* |
| Hatch | paper + −45° hatch · 32h | *Copy referral summary*, utility actions |
| Alert outline | `#A02B25` text + 35% ring | *Rule out…* |
| Icon | 36×36 · 1px rule → ink on hover | Pin, add child |
| Text | Geist 15 · ink-60 → ink | Nav, *Ask the engine* |
| Toggle | 28h · radius 4 · active = white + `0 1px 3px rgb(11 16 21/.12)` | Tree / Ranked / Trail |
| Decision ledger | 4 cells in a 1px-rule grid; `A · CONFIRM` mono key; the selected cell gets a blue wash and a 2px underline that draws across | Step 4 |

## Micro-animations

| Name | Spec | Arbor moment |
|---|---|---|
| `b-rise-in` | opacity 0, y 8px → 0 · 400ms standard · 80ms stagger | New findings / list rows |
| Spring re-rank | width on `--spring-36` `linear()` · 580ms | Round diff |
| `b-draw-across` | clip-path inset(0 100% 0 0) → inset(0) · 500ms `cubic-bezier(.22,1,.36,1)` | A branch is born, left to right |
| Strike rule-out | 1px line sweeps L→R 400ms; ink → ink-40 | Ruled out; the entry stays |
| `b-drift` | dashes 2/4, offset → −6px, 1.2s linear loop | The engine is reasoning (an edge in progress) |
| `b-shimmer` | gradient sweep through the label, 1.8s | A loading label inside a button |
| `b-live-pulse` | green ring 0→4px, 2s | Waiting for the doctor's input |
| `b-logo-draw` | stroke draws, then the fill fades up · 1.2s | App boot / empty state |
| Nav stagger | rise-in at +80ms steps | Rail on load |

Duration tokens: press 120 · hover 200 · reveal 300 · CTA 360 · link 400 · page 900 ms.

## Interactions

1. **Trace a node to its evidence.** Hover/focus a node: its edge switches to a
   drifting blue dash, and the findings tint blue/red with +/− glyphs. Hover a
   finding for the reverse. Click to hold.
2. **Rail + scroll-spy.** A 208px left rail lists the sections (Presentation ·
   Assessment · Rounds · Decision · Follow-up) and highlights the one in view.
3. **Copy-able artefacts.** Hatch buttons copy text (the referral summary, the
   safety-net advice), with a "COPIED" label swap.
4. **Gradient link underline** slides on hover (400ms).
5. **Human / Agent toggle** (the source's literal pattern), reusable as a
   filter: *show only clinician decisions / only agent proposals* on the trail.

## Accessibility notes (production adjustments)

- Blue on white **5.25** ✓ · on-blue label **5.09** ✓ · alert **7.32** ✓ · ink-60 **4.98** ✓
- ink-45 labels **3.08** ✗ → use ink-60 for any label that carries meaning; keep ink-45 for decoration only
- Ruled-out text at ink-40 is **2.66** ✗ → in production use ink-60 + strike + the "ruled out" stamp (the dimming is a cue, not the only signal)
- The texture semantics (hatch = zebra) need a text label too (the specimen shows `ZEBRA`)
- 11px mono caps is the floor; use 12px for actionable labels
- `prefers-reduced-motion` is handled in `tokens.css`
