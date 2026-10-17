# Timeline fork verification

17 October 2026. Specification: [specs/timeline-forking.md](specs/timeline-forking.md).

## Automated HTTP checks

The API suite exercises a historical fork after the parent has acquired newer
findings, sources, tests, events, and a synthetic calculation. It verifies that
those future values do not enter the fork; inherited references and citation
indices remain intact. Mutating/advancing one fork leaves the parent, sibling,
and inherited history unchanged. Nested forks retain hypothetical provenance.

Other cases cover invalid/missing frames, busy-parent rejection, retained test
gates, reopened diagnosis/treatment frames, server-enforced hypothetical manual
inputs, and exclusion of those inputs from documented-patient coding evidence.
Inference is injected in these tests; creating a fork requires no inference.
An additional regression covers reopening a clinician-confirmed diagnosis that
still has an unanswered proposed test: the fork restores the gate and rejects
advance until an explicit hypothetical result is entered.
Historical event payloads are copied at creation so later annotations cannot
leak into earlier events through shared object references.

## Browser checks

The collaborative preview exercised a synthetic case with two observations:

- Forking starts off; historical review shows no fork button and no live chat.
- Enabling the switch and selecting an old step reveals explicit fork creation.
- Creation opens a separate labelled exploration, without the later observation.
- A manually entered assumed result shows a Hypothetical badge.
- Returning to the parent restores its actual observations without that assumption.
- Disabling hides creation while the case switcher retains both records.
- Reloading resets the switch to off and the saved exploration remains accessible.
- Narrow-width controls wrap without horizontal page overflow.
- The guided tour remains scripted, with illustrative probability labels and no
  forking switch. No browser console errors were observed.

Only the two cases created for this browser check were deleted (HTTP 204).
No paid model/search requests were made for fork verification. Source-code and
HTTP tests verify isolation; clinical accuracy is outside this feature's scope.

Cases and forks remain in memory and are lost on server restart, as before.
