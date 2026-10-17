# Typefaces

All the fonts below were found in the reference sites' `@font-face` rules on
2026-10-17. All are under the **SIL Open Font License** and available on Google
Fonts, so they are free to use and self-host. Drop font files (`.woff2`) and
specimens into this folder when we self-host.

| Font | Seen on | Role in Arbor | Weights we use | Get it |
|---|---|---|---|---|
| **Noto Serif** | layerwise.ai/manipulation (H1 60px, H2 30px) | A · display + headings | 400, 600, italic 400 | [Google Fonts](https://fonts.google.com/specimen/Noto+Serif) |
| **Open Sans** | layerwise.ai/manipulation (body, UI) | A · body + UI | 400, 500, 600, 700 | [Google Fonts](https://fonts.google.com/specimen/Open+Sans) |
| **Space Grotesk** | layerwise.ai (TOC, captions, chart titles) | A · labels | 400, 500, 600 | [Google Fonts](https://fonts.google.com/specimen/Space+Grotesk) |
| **Roboto** | attnlrp-demo (all UI, H1 900 −4%) | A · alternative UI font | 400, 500, 900 | [Google Fonts](https://fonts.google.com/specimen/Roboto) |
| Roboto Serif | attnlrp-demo (loaded, unused) | — | — | [Google Fonts](https://fonts.google.com/specimen/Roboto+Serif) |
| **Roboto Mono** | (stand-in for `ui-monospace`) | A · data, codes, vitals | 400, 500 | [Google Fonts](https://fonts.google.com/specimen/Roboto+Mono) |
| **Geist** | supermemory.ai (everything) | B · display + UI + body | 400, 500, 600 | [Google Fonts](https://fonts.google.com/specimen/Geist) |
| **Geist Mono** | supermemory.ai (CAPS labels, buttons) | B · labels, buttons, data | 400, 500 | [Google Fonts](https://fonts.google.com/specimen/Geist+Mono) |

## Pairing logic

- **A · Attribution:** a serif for *meaning* (diagnoses, headings), a humanist
  sans for *reading* (Open Sans), a grotesk for *labelling* (Space Grotesk), and
  a mono for *numbers*.
- **B · Ledger:** one family in two cuts. Geist for prose, Geist Mono CAPS for
  every label, so you can tell at a glance what is UI and what is content.

## Clinical reading rules (both languages)

- Body ≥ 16px; actionable labels ≥ 12px; nothing meaningful below 11px.
- Use tabular numbers for probabilities, vitals and labs (`font-variant-numeric: tabular-nums`, which Geist Mono and Roboto Mono have by default).
- Diagnoses are always set in sentence case and never truncated without a tooltip.
- German (the UI may need DE): test long compounds, e.g. *Mittelohrentzündung*, in node widths.
