# Timeline forks — agreed implementation specification

Confirmed by the user on 17 October 2026. Scope: `Claude_Hackathon_Berlin`
only. The original `corti-dx-arbor` repository is not modified. Review baseline:
`5524e0930b9561f1468732e0838ef5c7702ecf49` (Claude app and Opus UI polish).

## Agreed behavior

1. A top-right **Forking** switch is available in a live case and starts OFF.
   It is not persisted across page reloads. Guided-tour behavior stays scripted
   and has no fork action.
2. When enabled, selecting a historical timeline frame reveals **Fork from
   here**. Creating a fork is an explicit action, never a side effect of
   scrubbing. Disabling the switch hides creation without deleting forks.
3. A fork creates and opens a separate **What-if exploration** case linked to
   the original and its selected step. The original case is unchanged. A
   parent-return control and related-case navigation keep both accessible.
4. The server copies state as it stood AFTER the selected step, not current
   mutable state: findings, sources, tree, tests, events and history only up
   to that point. To explore a different result, select the step before it.
   Presentation is currently immutable and is copied from the parent.
5. The new case reopens diagnosis reasoning: clear working/pending diagnosis
   and treatment, return confirmed hypotheses to live, retain ruled-out and
   branched nodes, and retain a pending test gate when applicable. Record the
   reset in the fork event/history. Never infer or order a new test on creation.
6. Label the case and newly entered manual findings as hypothetical. Preserve
   the observed/hypothetical distinction of inherited findings. Do not permit
   a request to disguise new fork findings as actual patient observations.
   Hypothetical findings must not authorize an actual documented coding claim.
   Live probabilities remain unavailable; forking introduces no new scoring.
7. Fork creation requires no Claude/Tavily call. Resolve frame identity from
   server-held history, validate requests, and reject a busy parent workflow.
   Parent, sibling, and inherited snapshot objects must remain independent.
8. Historical review remains read-only. Chat must not silently use live/future
   context while reviewing a past frame. Switching cases must clear local
   forms/chat and prevent delayed parent responses from replacing the fork.

## Verification

Exercise the public HTTP workflow for historical isolation, independent
mutation, pending test gates, diagnosis/treatment reset, nested forks,
hypothetical provenance, invalid frames, and busy parents. Use synthetic data
and injected inference fixtures; fork creation must not invoke inference.
Browser-check default-off, enabling, scrubbing, creation, parent/branch
navigation, hypothetical labels, disabling, reload default, and the unchanged
guided tour. Run typecheck, production build, and full tests after changes.

Review Standards and Spec independently, fix material findings, and commit on
the existing `main` branch. No push is requested. Current in-memory storage
means original cases and forks are both lost on server restart.
