# Visual language A — "Attribution"

> Warm editorial calm, with a relevance heatmap. Every finding can be traced
> to the hypotheses it pushes up (blue) or down (red).

- **Derived from:** [attnlrp-demo.layerwise.ai](https://attnlrp-demo.layerwise.ai) and [layerwise.ai/manipulation](https://layerwise.ai/manipulation), extracted 2026-10-17
- **Files:** [`tokens.css`](tokens.css) (drop-in CSS variables + keyframes) · [`specimen.html`](specimen.html) (live palette, type, buttons, motion, tree interaction)
- **Raw values:** [`../../ui-references/2026-10-17_extracted-values_layerwise-supermemory.md`](../../ui-references/2026-10-17_extracted-values_layerwise-supermemory.md)
- **Screenshots:** `../../inspiration/2026-10-17_*_layerwise.jpg`

## Personality

| Feels | Because |
|---|---|
| Trustworthy, like a journal | Serif display headlines (Noto Serif), generous whitespace |
| Warm, not clinical-cold | Warm neutrals (`#F5F5F5` page, `#1E130F` ink, `#DAD7D0` borders) |
| Explainable | The AttnLRP heatmap: hover anything to see what it is attributed to |
| Soft and approachable | Pills and 16px cards, shadow only on hover |

**Best for:** the clinician-facing workspace when we want the tool to feel like
a calm, explainable colleague, and the hover-to-attribute pattern is the hero.

## Typography

| Role | Font | Spec |
|---|---|---|
| Display | **Noto Serif** 400 | 60/63, −3% (manipulation H1) |
| H1 / H2 | Noto Serif 400 | 36 / 30, line-height 1.1–1.2 |
| UI + body | **Open Sans** 400/500/600 | body 16/24 · UI 14/20 |
| Labels, captions, TOC | **Space Grotesk** 400/500 | 13–14 |
| Micro-labels | Open Sans 600 UPPERCASE | 9.5px, +5% (use ≥11px in the clinical UI) |
| Data, codes, vitals | **Roboto Mono** 400/500 | 12 |

The sources self-host Roboto, Roboto Serif, Open Sans, Noto Serif and Space
Grotesk as variable TTFs. All are on Google Fonts under the OFL. Roboto Mono
stands in for the `ui-monospace` stack. See [`../../typeface/`](../../typeface/).

## Colour (hex)

**Neutrals:** bg `#F5F5F5` · surface `#FFFFFF` · sunken `#F2EEE7` · tint `#ECE3D6` · border `#DAD7D0` · muted ink `#655753` · ink `#1E130F` (body text at 92%; labels at 60%)

**Action:** primary `#0068CF` → hover `#005BB5` → press `#004E9C` · ring `#096DD2` · link `#007AFF` · accent mint `#B6DFCD` on `#0B221D` · destructive `#DF2224` · ok `#00C950`

**Relevance heat → evidence:** for `#60A5FA` (bg at 28%) · against `#F87171` (bg at 28%) · strong variants `#2563EB` / `#DC2626` · amber highlight `#FFA100`

**Arbor semantics (from the role swatches):** zebra `#A78BFA` · must-not-miss `#FB923C` · agent `#38BDF8` · clinician `#2DD4BF` · trusted/verified `#009966` · untrusted/reported `#E17100`

**Dark:** bg `#1E1E1E` · surface `#323232` · ink `#FFFFFF` · primary `#0E85FB` (from the attnlrp `.dark` theme)

## Buttons

| Variant | Spec | Arbor use |
|---|---|---|
| **Primary** | 44h · radius 16 · `#0068CF` · white 16px/400 · hover `#005BB5` + `0 8px 32px rgb(0 0 0/.05)` · press scale .97 | *Run next round*, *Confirm* (one per view) |
| Secondary | 40h pill · white · 1px inset `#DAD7D0` · hover sunken | *Order test & park*, *Refer* |
| Pill | 36h · `#EFEFEF` · 14/500 (manipulation nav) | View switches, *Go to decision* |
| Ghost | text ink-60 → ink on hover with a 6% wash | *Ask the engine*, *Replay* |
| Destructive outline | red text + 35% red ring | *Rule out…* (always asks for a reason) |
| Icon | 40×40 · radius 14 · `#EFEFEF` | Pin, add child, more |
| Segmented | 6% ink track, active = solid ink pill | Tree / Ranked / Trail |
| Decision card | radius 16 card · colour dot · title + one line · selected = 2px primary ring | Step 4: Confirm · Refer · Investigate · Unresolved |

All transitions: `150ms cubic-bezier(.4,0,.2,1)`; focus: `0 0 0 3px rgb(9 109 210/.35)`.

## Micro-animations

| Name | Spec | Arbor moment |
|---|---|---|
| `a-fade-in-token` | opacity 0→1, y .1em→0, 150ms, 18ms per-word stagger | Engine message streams in |
| Probability re-rank | bar width, 700ms `cubic-bezier(0,0,.2,1)` | Round diff |
| `a-plop` | overlay 0 → .7 → .2 opacity, 600ms | A finding lands on a node |
| Branch grow | stroke-dashoffset 160→0, 700ms; children fade in +450ms | A hypothesis branches |
| Dim | opacity →.4 + grayscale, 400ms | Ruled out (stays on the tree) |
| Highlight sweep | background-size 0→100%, 600ms | A cited claim is revealed |
| `a-hint` | inset 2px green ring pulse, 2s loop | The HITL gate waits for the doctor |
| `a-trace-flow` | dash offset → −20, 1s linear loop | The path from the root to the selected node |

## Interactions

1. **Hover to attribute (signature).** Hover or focus a hypothesis and the
   findings light up blue (for) and red (against). Hover a finding and the tree
   lights up. Click holds the highlight. This is the AttnLRP token-hover pattern
   mapped onto the reasoning tree.
2. **Shadow on hover.** Cards are flat at rest and lift with a soft shadow on hover.
3. **Segmented switch.** Tree / Ranked list / Trail.
4. **Sticky section TOC** (manipulation) for the long reasoning trail and the referral summary.
5. **"Replay"**, borrowed from the manipulation figure's *Replay attack*: replays how the tree got here (pairs with the time-travel scrubber).

## Accessibility notes (production adjustments)

Contrast was measured against the extracted values:
- Primary on white **5.41** ✓ · ink-60 on white **4.78** ✓ · destructive **4.78** ✓
- ink-50 labels on bg **3.38** ✗ → use ink-60 for any meaningful text
- trusted `#009966` **3.65** ✗ / untrusted `#E17100` **3.20** ✗ as text → darken to `#007A52` / `#A85400`, or use them only as dots
- Heat backgrounds keep the ink text at 14:1. Every heat tag also carries ▲/▼, so meaning never depends on colour alone (blue/red is distinguishable for most colour-vision deficiencies, but not all).
- Micro-labels at 9.5px are below a comfortable clinical reading size; use 11px minimum.
- `prefers-reduced-motion` reduces every animation to 1ms (in `tokens.css`).
