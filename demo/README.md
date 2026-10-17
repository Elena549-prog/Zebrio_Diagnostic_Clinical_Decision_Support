# Zebrio — clickable demo

## Live application

The React app at `http://localhost:5175/` now uses this prototype's Zebrio
branding, typography, Attribution palette, floating three-pane layout,
dotted reasoning canvas, rounded controls and evidence inspection colours.
The adaptation lives in `web/src/zebrio.css`; the live tree uses the same
theme tokens. Run the app with `npm run dev` from the repository root.

The live app retains its API-driven workflow, clinician gates, coding links,
timeline and what-if forks. This HTML remains a separate static prototype:
its illustrative percentages, proposed rule-out controls, visit outcomes
and follow-up simulation are not live clinical capabilities.

A single-file, no-build prototype of the Zebrio clinician workspace (a
retraceable differential-diagnosis tool for GPs and pediatricians). It uses
visual language A, "Attribution".

**Run it:** open `index.html` in a browser. No server, install or API key is
needed. Fonts load from Google Fonts; without internet the page falls back to
system fonts.

**Publish on GitHub Pages:** upload this `demo/` folder to a repository, then
go to *Settings → Pages → Deploy from a branch*. The demo is served at
`https://<user>.github.io/<repo>/demo/`.

## What you can do

All five steps can be opened at any time, from the left rail or the timeline:

1. **Presentation**: chief complaint, history, demographics, comorbidities; confirm the base-rate context
2. **Assessment**: vitals, examination, laboratory and imaging columns
3. **Reasoning**: the hypothesis tree
   - hover a hypothesis to see its evidence for (blue) and against (red); hover a finding to see which hypotheses it affects
   - pin as must-not-miss, rule out with a reason (the node stays on the tree, dimmed), restore, or add your own hypothesis
   - enter a test result, run round 2, then accept or reject the proposed rule-out
4. **Decision**: Confirm · Refer · Investigate further · Remain unresolved, with a must-not-miss guard on Confirm
5. **Follow-up**: the visit outcome, the reasoning trail, and "Start visit 2"

## About the content

- **Case facts** (presentation, history, observations, demographics) are taken word for word from test case `golden-2-breathlessness`.
- **Illustrative only, not hypothesis-engine output:** the hypotheses, the percentages, the for/against weights, the proposed chest X-ray and the round-2 re-ranking. They are placeholders that show how the UI behaves, and they are labelled as such in the demo.
- No engine is connected; "Ask the engine" says so.

Research/demo prototype. Not a medical device and not medical advice.
