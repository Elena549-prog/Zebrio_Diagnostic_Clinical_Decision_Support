# Adopted UI-library patterns

17 October 2026. Applied to the existing Claude frontend without changing its
clinical workflow or server contracts.

## Sources and decision

Use the [Attribution visual language](../01-design-library/visual-languages/A-attribution/README.md)
and [interaction catalogue](../01-design-library/interactions/README.md) for
on-demand evidence inspection. Keep Arbor's existing teal action colour, warm
surfaces, hypothesis tree, tabbed inspector and clinician checkpoints. The
Ledger directory was removed from this repository; its missing specimen is not
treated as an implementation source.

## Brought into the frontend

- Hover or keyboard-focus a hypothesis to highlight its linked findings.
- Hover or focus a finding to highlight the hypotheses it is linked to.
- Selection holds the relationship; Escape clears the highlighting. Previewing
  never changes the selected working diagnosis or records a clinical action.
- Show explicit supporting/contradicting finding counts on tree and ranked-list
  nodes. Counts describe stored links, not confidence, evidence quality or risk.
- Preserve readable text and direction symbols alongside the blue/red washes.
- Allow Tab and arrow navigation between tree nodes, Enter/Space to inspect.
  Mark the path to the selected node and keep ruled-out branches visible.
- Expose the recorded finding source directly; do not promote literature or
  reported observations to lab-verified results.
- Name the existing playback action "Replay case" and honour reduced-motion
  preferences across existing and new animations.

Attribution reads only the displayed case/frame. It does not calculate model
attention, causal attribution, information gain or patient probabilities.

The draft [clinician PRD](PRD-arbor-clinician-ui.md) also describes referral,
monitoring, encounters, clinician hypothesis editing and must-not-miss pins.
Those need domain/API work and are not represented as working controls here.
