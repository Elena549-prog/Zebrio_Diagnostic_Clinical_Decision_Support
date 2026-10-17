async (page) => {
  const results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const right = page.locator('.pane.right');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:5175/#/tutorial');
  await page.reload();
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await right.getByRole('tab', { name: 'Reference', exact: true }).click();
  assert(await right.getByText('Base-rate context', { exact: true }).isVisible(), 'Tutorial references missing');
  assert(await right.getByRole('button', { name: 'Confirm working dx', exact: true }).count() === 0, 'Tutorial has confirmation action');
  await right.getByRole('tab', { name: 'Reference', exact: true }).press('Home');
  assert(await right.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected') === 'true', 'Home key failed');
  await right.getByRole('tab', { name: 'Overview', exact: true }).press('ArrowRight');
  assert(await right.getByRole('tab', { name: /^Evidence/ }).getAttribute('aria-selected') === 'true', 'Arrow key failed');
  assert(await page.locator('.na-stage').textContent().then(text => text.includes('Step 2 / 7')), 'Tab key also advanced tutorial timeline');
  await right.getByRole('tab', { name: /^Evidence/ }).press('End');
  assert(await right.getByRole('tab', { name: 'Reference', exact: true }).getAttribute('aria-selected') === 'true', 'End key failed');
  await page.locator('.node-card-name').filter({ hasText: 'Viral / post-infectious arthralgia' }).click();
  assert(await right.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected') === 'true', 'Selection did not reset tab');
  results.push('Tutorial: tabs, keyboard navigation, selection reset and read-only actions passed');

  const data = await page.evaluate(async () => {
    const { TUTORIAL_STEPS } = await import('/src/tutorialCase.ts');
    const { SCENARIOS } = await import('/src/scenarios.ts');
    const c = structuredClone(TUTORIAL_STEPS[4].case);
    c.id = 'panel-ui-fixture'; c.title = 'Synthetic panel verification';
    c.status = 'reasoning'; c.probabilityMode = 'unavailable'; c.history = []; c.events = [];
    c.workingDiagnosis = undefined; c.pendingDiagnosis = undefined; c.treatmentPlan = undefined; c.awaitingHitl = false;
    const hs = Object.values(c.hypotheses);
    const h = hs[0], other = hs[1], pruned = hs[2];
    h.name = 'Cystic fibrosis'; h.status = 'live'; h.probability = .6;
    other.status = 'live'; other.probability = .3; pruned.status = 'ruled_out'; pruned.probability = 0;
    const index = Math.max(0, ...c.sources.map(s => s.index)) + 1;
    c.sources.push({ index, title: 'Synthetic UI verification source', url: 'https://example.org/ui-source', type: 'web', addedRound: 1 });
    h.description = ('Synthetic supplied description with a preserved citation. ').repeat(8) + '[' + index + ']';
    h.baseRateNote = 'Supplied population context [' + index + ']';
    h.codes = [{ system: 'UI fixture', code: 'TEST', display: 'Synthetic code display', url: 'https://example.org/ui-code', reasoning: 'Supplied code rationale' }];
    c.findings.push({ id: 'against-ui', summary: 'Synthetic counterfinding [' + index + ']', source: 'clinician', direction: 'against', hypothesisIds: [h.id], sourceIndices: [index], hypothetical: true, createdAt: c.updatedAt });
    h.evidenceAgainst = [{ findingId: 'against-ui', weight: 'Fallback must not replace supplied finding' }];
    h.discriminatingTests = [
      { id: 'ui-test-1', name: 'First supplied test', rationale: 'First supplied rationale [' + index + ']', status: 'proposed', discriminatesBetween: [h.id, other.id] },
      { id: 'ui-test-2', name: 'Second supplied test', rationale: 'Second supplied rationale [' + index + ']', status: 'proposed', discriminatesBetween: [h.id, other.id] },
    ];
    h.rarity = await fetch('/api/reference-data/rarity?name=Cystic%20fibrosis').then(r => r.json());
    h.populationContextUsed = { round: c.round, pass: 1, recordIds: ['16684'] };
    return { c, ids: [h.id, other.id, pruned.id], names: [h.name, other.name, pruned.name], scenarioTitle: SCENARIOS.find(s => s.golden).title, plan: TUTORIAL_STEPS[6].case.treatmentPlan };
  });
  const fixture = data.c;
  let diagnosed;
  await page.route('**/api/cases**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/cases') return route.fulfill({ json: request.method() === 'GET' ? [] : fixture });
    if (path.endsWith('/stream')) return route.fulfill({ contentType: 'text/event-stream', body: 'event: snapshot\ndata: ' + JSON.stringify(fixture) + '\n\n' });
    if (path.endsWith('/diagnose')) {
      diagnosed = request.postDataJSON().hypothesisId;
      const h = fixture.hypotheses[diagnosed];
      fixture.workingDiagnosis = { hypothesisId: h.id, name: h.name, reasoningTrail: ['Supplied trail [1]'], concludedAt: fixture.updatedAt };
      fixture.status = 'converged'; h.status = 'confirmed';
      return route.fulfill({ json: fixture });
    }
    if (path.endsWith('/treat')) {
      fixture.treatmentPlan = data.plan;
      fixture.treatmentPlan.steps[0].citation = { label: 'Preserved treatment source', url: 'https://example.org/ui-treatment' };
      fixture.status = 'closed';
      return route.fulfill({ json: fixture });
    }
    return route.fulfill({ status: 500, json: { error: 'Unexpected UI fixture request: ' + path } });
  });
  await page.goto('http://localhost:5175/');
  await page.getByRole('button').filter({ hasText: data.scenarioTitle }).click();
  const select = async name => page.locator('.node-card-name').filter({ hasText: name }).click();
  await select(data.names[0]);
  assert(await right.getByText('Agent rank #1 (model judgment)', { exact: true }).isVisible(), 'Rank missing');
  assert(await right.locator('.hypothesis-concern .hypothetical-badge').isVisible(), 'Concern hypothetical badge lost');
  assert(await right.getByText('First supplied test', { exact: true }).isVisible(), 'First test missing');
  assert(await right.getByText('Second supplied test', { exact: true }).isVisible(), 'Second test missing');
  await right.getByRole('button', { name: 'show more', exact: true }).click();
  await right.getByRole('tab', { name: /^Evidence/ }).click();
  assert(await right.locator('[role=tabpanel]:visible .hypothetical-badge').count() === 1, 'Full evidence badge lost');
  assert(await right.locator('[role=tabpanel]:visible .against').count() === 1, 'Against evidence lost');
  assert(await right.locator('[role=tabpanel]:visible .supports').count() === fixture.hypotheses[data.ids[0]].evidenceFor.length, 'Supporting evidence lost');
  assert(await right.locator('[role=tabpanel]:visible a[href="https://example.org/ui-source"]').count() > 0, 'Evidence citation lost');
  await right.getByRole('tab', { name: 'Reference', exact: true }).click();
  assert(await right.getByText('Supplied code rationale', { exact: true }).isVisible(), 'Code rationale lost');
  assert(await right.locator('a[href="https://example.org/ui-code"]').isVisible(), 'Code link lost');
  await right.getByText('Frequency details: conversion, bounds and sources', { exact: true }).click();
  assert(await right.getByText(/Record 16684/).count() > 0, 'Population record lost');
  assert(await right.locator('a[href="https://pubmed.ncbi.nlm.nih.gov/25914230/"]').count() > 0, 'Population study link lost');
  const nav = right.locator('.hypothesis-tabs');
  await nav.getByRole('tab', { name: 'Reference', exact: true }).focus();
  await page.keyboard.press('Home');
  assert(await right.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected') === 'true', 'Keyboard reset failed in live view');
  await right.getByRole('tab', { name: 'Reference', exact: true }).click();
  await select(data.names[1]);
  assert(await right.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected') === 'true', 'Live selection did not reset tab');
  assert(await right.locator('.hypo-desc.open').count() === 0, 'Description expansion carried to another hypothesis');
  assert(await right.locator('.detail-panel').evaluate(el => el.scrollTop) === 0, 'Selection did not reset scroll');
  await select(data.names[2]);
  assert(await right.locator('.hypothesis-target-note').isVisible(), 'Pruned-selection confirmation target not explained');
  await select(data.names[0]);
  await page.getByRole('button', { name: /^Ask the engine/ }).click();
  for (const width of [1280, 900]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
    assert(await right.getByRole('button', { name: 'Confirm working dx', exact: true }).isVisible(), 'Confirmation hidden with chat open');
    if (width === 900) assert(await right.locator('.hypothesis-confirm-footer').evaluate(el => getComputedStyle(el).position) === 'static', 'Stacked footer is sticky');
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: /^Ask the engine/ }).click();
  await right.getByRole('button', { name: 'Confirm working dx', exact: true }).click();
  assert(diagnosed === data.ids[0], 'Confirmation sent wrong hypothesis ID');
  assert(await right.locator('.verdict-card').isVisible(), 'Working diagnosis card missing');
  assert(await right.locator('.hypothesis-confirm-footer').count() === 0, 'Confirmation remains after diagnosis');
  await page.getByRole('button', { name: 'Build treatment plan', exact: true }).click();
  assert(await right.locator('.treatment-card').isVisible(), 'Treatment view missing');
  assert(await right.locator('.treatment-card a[href="https://example.org/ui-treatment"]').isVisible(), 'Treatment citation lost');
  results.push('Synthetic live fixture: all evidence, both tests, citations, code links and full population provenance retained');
  results.push('Selection reset, pruned-target note, responsive chat/confirmation and correct diagnosis request passed');
  results.push('Working diagnosis and treatment views retained; zero paid model requests');
  console.log(JSON.stringify(results));
}
