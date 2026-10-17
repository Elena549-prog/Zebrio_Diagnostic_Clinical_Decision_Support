# Population-frequency integration verification

17 October 2026. Scope: [user-confirmed behavior](specs/population-frequency-context.md).
Implementation commits: `7c8ddd1`, review fixes `94e0f50`. Team submissions
merged in `b15005d`; only README required conflict resolution, preserving the
application instructions and standalone module source documentation.

- Application: all 77 offline tests, server/web type checks and production build passed.
- Standalone evidence module: clean dependency install, type check and all 74
  offline tests passed after merge. It remains separate from the running app.
- Standards review: 0 actionable findings. Spec review: 2 P2 display omissions
  (explicit right-panel ordinal rank and inspectable provenance), both fixed;
  independent re-review found 0 remaining findings.
- Browser: served the production UI with an isolated synthetic case and stubbed
  model responses. The real ranking pipeline performed two passes and used the
  downloaded ORPHA:586 German point-prevalence record. No paid inference/search
  calls or actual patient records were used for this check.
- Selecting the diagnosis in List view updated the existing persistent right
  pane. Expanding frequency details showed model rank #1, approximately 0.0112%,
  original 11.1954 per 100,000, deterministic conversion to 0.0111954%, record
  16684/ORPHA:586, source links, the index SHA-256, June 23 export and July release.
  Underlying study date remained unknown. The additional Europe record was
  marked not supplied to the agent in that round. No horizontal page overflow.
- Fixture tests cover first-round and later-new-candidate context, existing
  candidate context, missing matches, S-ref citations, cancellation rollback,
  point/bound conversions, unknown qualification and source preservation.

These checks establish application contracts and arithmetic. They do not
establish clinical ranking accuracy or calibrated patient probabilities.
The latter remain unavailable; population context does not confirm a diagnosis
or change clinician test-ordering/confirmation gates.
