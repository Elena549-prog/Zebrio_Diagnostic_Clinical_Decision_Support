# Extracted values — Layerwise & Supermemory (2026-10-17)

These are raw values read from the live pages' computed styles, `:root` custom
properties, `@font-face` and `@keyframes` rules, taken in the built-in
browser on 2026-10-17. OKLCH values were converted to sRGB hex. They are
reference data; the two visual languages built from them live in
[`../visual-languages/`](../visual-languages/).

Screenshots (low-res captures, for orientation only) are in [`../inspiration/`](../inspiration/).

---

## 1. attnlrp-demo.layerwise.ai — "Explaining & Steering LLMs"

**What it is:** an interactive tool that traces an LLM answer back to its input.
Hovering an output token colours the input tokens by relevance: blue for
positive, red for negative. There is a prediction timeline bar chart and two
ring gauges (context grounding and hallucination risk).

**Fonts (`@font-face`, self-hosted variable TTFs)**
- `Roboto` 100–900 (+ italic): all UI and body text, 400 dominant
- `Roboto Serif` 100–900: loaded, but unused on the screen inspected
- `Space Grotesk` 100–900: loaded, used for labels on the layerwise.ai pages
- H1: Roboto **900**, 36px / 36px, letter-spacing −1.44px (−0.04em)
- Body: 16/24 · small: 14/20

**`:root` tokens (light)**
| token | value | hex |
|---|---|---|
| `--background` | #f5f5f5 | `#F5F5F5` |
| `--card` | white | `#FFFFFF` |
| `--foreground` | oklch(20% .02 40.36) | `#1E130F` (warm near-black) |
| `--primary` | #0068cf | `#0068CF` |
| `--ring` | #096dd2 | `#096DD2` |
| `--secondary` | oklch(92% .02 79.18) | `#ECE3D6` |
| `--muted` | oklch(95% .01 84.59) | `#F2EEE7` |
| `--muted-foreground` | oklch(47% .02 38.95) | `#655753` |
| `--accent` | oklch(87% .05 167.24) | `#B6DFCD` |
| `--accent-foreground` | oklch(23% .03 177.92) | `#0B221D` |
| `--destructive` | oklch(58% .22 27.33) | `#DF2224` |
| `--border` / `--input` | oklch(88% .01 84.59) | `#DAD7D0` |
| `--radius` | 1.25rem | 20px |

**Dark (`.dark`)**: background `#1E1E1E`, card `#323232`, foreground `#FFFFFF`, primary `#0E85FB`.

**Text inks:** the foreground ink at several alphas: 92% (body), 60%, 55%, 50% (labels).

**Attribution heat (the key pattern)**
- Positive relevance: `#60A5FA` (Tailwind blue-400), used as a token background and underline
- Negative relevance: `#F87171` (Tailwind red-400)
- Ok / status dot: `#22C55E`-ish (`oklch(.723 .219 149.6)` → `#00C950`)
- Role swatches (10px dots): orange `#FB923C`, red `#F87171`, blue `#60A5FA`, rose `#FB7185`, fuchsia `#E879F9`, violet `#A78BFA`, sky `#38BDF8`, teal `#2DD4BF`, green `#4ADE80`, yellow `#FACC15`
- Swatch ring: `inset 0 0 0 1px rgba(30,19,15,.12)`

**Shape & depth**
- Cards: radius 16px; inner panels 11.2px (0.7rem); pills 9999px
- Shadow: `0 8px 32px rgba(0,0,0,.05)` (shows on hover through the `shadowOnHover` class)
- Primary CTA "Generate Output": a 44px-high container, bg `#0068CF`, radius 16px, white 16px label, `background-color .16s`

**Motion**
- `fadeInToken`: opacity 0→1, translateY(.1em)→0 (tokens stream in)
- `fadeIn` 0→1; spinner `rotate 0→720deg`
- `columnHighlightOverlayPlop`: 0 → .7 (65%) → .2 opacity (the highlight "plops", then settles)
- Tailwind default transitions: `150ms cubic-bezier(.4,0,.2,1)`; box-shadow `.16s`
- Toasts: Sonner (`scale .8→1`, swipe-out)

## 2. layerwise.ai/manipulation — research article

**What it is:** an editorial long-read with a sticky "Sections" table of
contents, interactive figures (segmented control, "Replay attack"),
trusted/untrusted labels in monospace, and a full-bleed generative-art hero.

**Fonts**
- `Noto Serif` 400/600: headlines (H1 60px/63px, −1.8px (−0.03em); H2 30/36)
- `OpenSans` 400/500/600: body 16/24, UI 14/20
- `Space_Grotesk` 400–600: TOC, figure captions, chart titles (24/32)
- `ui-monospace`: code/data in figures (11px)
- Micro-labels: OpenSans 600, 9.5px, +0.475px tracking, uppercase ("SECTIONS", "RESEARCH")

**`:root` tokens**
| token | hex |
|---|---|
| `--background` | `#FFFFFF` |
| `--foreground` | `#0A0A0A` |
| `--primary` | `#171717` (oklch .205) |
| `--secondary` | `#E1E1E1` |
| `--muted` / `--accent` | `#F5F5F5` |
| `--muted-foreground` | `#737373` |
| `--cta` | `#007AFF` (dark: `#0A84FF`) |
| `--switch-on` | `#34C759` |
| `--highlight-amber` | `#FFA100` |
| `--highlight-blue` | `#0099FF` |
| `--highlight-red` | `#EA3300` |
| `--destructive` | `#E7000B` |
| `--border` | `#0000001A` |
| `--input` | `#EBEBEB` |
| `--radius` | .625rem (10px) |
| chart-1..3 | `#F54900`, `#009689`, `#104E64` |
| trusted (green text) | `#009966` |
| untrusted (orange text) | `#E17100` |
| nav pill bg | `#EFEFEF` |
| warm greys | `#79716B`, `#A6A09B`, border `#E7E5E4` |

**Shape**: nav pills (radius 9999px, `8px 16px`, bg `#EFEFEF`, 14px/500);
icon buttons (radius 14px, `8px 12px`); figure cards (radius 24–32px);
blockquote with a 3px black left rule, serif italic.

**Motion**
- `lw-citation-highlight-reveal`: `scaleX(0→1)`, a highlighter sweep under cited text
- `trace-flow`: `stroke-dashoffset → −20`, marching dashes along a trace line
- `demo-hint`: an inset 2px ring pulsing `rgba(5,150,105,0→.5→0)`, inviting a click
- `lw-marquee`: logo strip translate −50%
- Reveal: `transform .7s cubic-bezier(0,0,.2,1)`; opacity `1s`
- Tailwind `pulse` 2s

## 3. supermemory.ai — home

**What it is:** a precise, technical, print-like layout. A 208px left rail
plus a 640px text column, square corners, hairline rules, monospace uppercase
labels, hatched fills, dotted grids, and a deep-blue generative hero.

**Fonts (self-hosted woff2 variable)**
- `Geist` 100–900: statement 40px/1.12, −1.2px (−0.03em); H2 24/30 −0.48px; body 17/1.65; UI 13–15px
- `Geist Mono` 400/500: labels 11–12.7px, +0.06em, UPPERCASE ("IN PRODUCTION", "BUILD WITH SUPERMEMORY")
- (`--font: "Space Grotesk"` is also declared in one scope, as a legacy token)

**`:root` tokens**
| token | value |
|---|---|
| `--paper` | `#F4F4F6` (page) |
| surface | `#FFFFFF` |
| `--ink` | `#0B1015` |
| `--ink-86` / `-68` / `-60` / `-45` | `#0B1015DB` / `AD` / `99` / `73` |
| `--rule` | `#DFDFDF` (also `#0B10151A`) |
| `--blue` | `#0562EF` |
| `--blue-deep` | `#0450C8` (also `#0446C9`) |
| `--blue-press` | `#033A9A` |
| `--blue-7` / `--blue-11` | `#0562EF12` / `#0562EF1C` (tints) |
| `--on-blue` / `--warmwhite` | `#F4F8FF` / `#FFFBF5` |
| `--tick` | `#9EC6F7` |
| `--logo-ink` | `#141B34` |
| `--live` | `#00C763` |
| `--link-start` → `--link-end` | `#0042AF` → `#0562EF` (gradient text link) |
| success dark | `#10A86A` |
| warm | `#FAFAFA` |

**Layout tokens:** `--rail-w 208px`, `--rail-gap 108px`, `--col-w 640px`,
`--measure-body 600px`, `--sp-section 72px`, `--sp-para 24px`.

**Easing & durations**
| token | value |
|---|---|
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` |
| `--ease-hover` | `cubic-bezier(.25,.1,.25,1)` |
| `--ease-standard` | `cubic-bezier(.4,0,.2,1)` |
| `--ease-cta` | `cubic-bezier(.23,1,.32,1)` |
| `--ease` | `cubic-bezier(.2,0,0,1)` |
| `--spring-36` | `linear(0, .0791, .2369, .4041, .5522, .6723, .7649, .8339, .884, .9198, .945, .9625, .9746, .9829, .9885, .9923, .9949, .9966, .9977, .9985, .999, 1, 1)` |
| `--dur-hover` | 200ms |
| `--dur-press` | 120ms |
| `--dur-reveal` | 300ms (900ms for page reveals) |
| `--dur-cta` | 360ms |
| `--dur-link` | 400ms |

**Primary button (`.btn-primary`)**: 44px tall, square, bg `#0562EF`, label
Geist Mono 500 12px +0.72px uppercase in `#FFFBF5`, padding `2px 11px 2px 2px`
(a 40px square **icon tile** sits flush left). On hover: a `::before` frame
insets (`clip-path: inset(2px)`), a `.btn-rail` slides `translate: 100%`, the
icon tile **rotates 360°**, and the label colour shifts. On press: `scale(.985)`, 120ms.

**Secondary**: white or paper with a 1px `#0562EF66` dashed/solid frame; "Talk to sales ↗".

**Segmented toggle** (Human / Agent): 28px, radius 4px; the active tab is white
with `0 1px 3px rgba(11,16,21,.12)`; the inactive one is ink-68.

**Textures**: hatch `repeating-linear-gradient(-45deg, #0B101509 0 1px, transparent 1px 4px)`;
dot grid `radial-gradient(#0B10151A 1px, transparent 1.25px)`; dashed rule
`repeating-linear-gradient(90deg, #DFDFDF 0 4px, transparent 4px 8px)`.

**Shadows**: float `0 1px 2px #0B10150D, 0 12px 32px -12px #0B10152E, 0 32px 64px -24px #0B101529`;
focus `0 0 0 3px #0562EF1C`.

**Keyframes**
- `rise-in`: opacity 0, translate 0 8px → 0 (400ms, standard)
- `draw-across`: `clip-path inset(0 100% 0 0) → inset(0)` (500ms, ease-out)
- `drift`: `stroke-dashoffset → −6px`, 1.2s linear infinite (dashed lines "flow")
- `shimmer-text`: a gradient mask sweeping across text, 1.8s linear (loading)
- `logo-draw`: stroke draws in, then the fill fades up (1.2s)
- `cookie-in`: 6px rise, 240ms `cubic-bezier(.2,0,0,1)`
- Nav items stagger in: opacity .4s with delays .12 / .20 / .28 … (+80ms each)
