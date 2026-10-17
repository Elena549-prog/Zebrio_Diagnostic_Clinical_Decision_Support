async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:5175/#/tutorial');
  await page.reload();
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  const tree = page.locator('.tree-node[role="button"]');
  assert(await tree.count() === 5, 'Hypotheses missing');
  const expected = await page.evaluate(async () => {
    const { TUTORIAL_STEPS } = await import('/src/tutorialCase.ts');
    const c = TUTORIAL_STEPS[1].case;
    const h = Object.values(c.hypotheses).find(h => h.evidenceAgainst.length && c.findings.some(f => f.id === h.evidenceAgainst[0].findingId));
    const f = c.findings.find(f => f.id === h.evidenceAgainst[0].findingId);
    return { h: h.id, f: f.id, states: Object.values(c.hypotheses).map(h => ({id:h.id,name:h.name,status:h.status,for:h.evidenceFor.length,against:h.evidenceAgainst.length})) };
  });
  const titleBefore = await page.locator('.hypothesis-title-row h3').textContent();
  const stageBefore = await page.locator('.na-stage').textContent();
  await page.locator('.tree-node[data-hypothesis-id="'+expected.h+'"]').hover();
  assert(await page.locator('.hypothesis-title-row h3').textContent() === titleBefore, 'Hover changed the selected hypothesis');
  const rows = page.locator('.finding[data-finding-id="'+expected.f+'"]');
  if (!await rows.first().isVisible()) {
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  }
  await page.locator('.tree-node[data-hypothesis-id="'+expected.h+'"]').hover();
  assert(await page.locator('.finding[data-finding-id="'+expected.f+'"][data-attribution="against"]').count() > 0, 'Hypothesis hover did not trace counterevidence');
  await page.locator('.finding[data-finding-id="'+expected.f+'"]').first().hover();
  assert(await page.locator('.tree-node[data-hypothesis-id="'+expected.h+'"]').getAttribute('data-attribution') === 'against', 'Finding hover did not trace hypothesis');
  assert(await page.locator('.tree-node[data-hypothesis-id="'+expected.h+'"] .node-attribution-label').textContent().then(t=>t.includes('counterevidence')), 'Direction is color-only');
  await page.locator('.finding[data-finding-id="'+expected.f+'"] .finding-dir').first().click();
  await page.locator('.canvas-toolbar').hover();
  assert(await page.locator('.tree-node[data-hypothesis-id="'+expected.h+'"]').getAttribute('data-attribution') === 'against', 'Click did not hold evidence tracing');
  await page.keyboard.press('Escape');
  assert(await page.locator('[data-attribution]').count() === 0, 'Escape did not release highlights');
  await tree.first().focus();
  assert(await tree.first().getAttribute('data-attribution') === 'focused', 'Keyboard focus did not preview');
  await tree.first().press('ArrowDown');
  assert(await page.locator('.na-stage').textContent() === stageBefore, 'Node arrow navigation advanced timeline');
  await page.keyboard.press('Enter');
  const selected = await page.locator('.tree-node[aria-pressed="true"]').getAttribute('data-hypothesis-id');
  const selectedExpected = expected.states.find(h=>h.id===selected);
  assert(await page.locator('.hypothesis-title-row h3').textContent() === selectedExpected.name, 'Keyboard selection did not open details');
  assert(await page.locator('.organics.selected-path').count() > 0, 'Selected path not visible');
  for (const h of expected.states) {
    const node = page.locator('.tree-node[data-hypothesis-id="'+h.id+'"]');
    assert(await node.locator('.tally-for').textContent() === '+'+h.for+' for', 'Supporting count incorrect');
    assert(await node.locator('.tally-against').textContent() === '−'+h.against+' against', 'Against count incorrect');
  }
  await page.getByRole('button', { name: 'List', exact: true }).click();
  assert(await page.locator('.ranked-item .evidence-tally').count() === 5, 'List omitted evidence counts');
  await page.locator('.ranked-item').first().focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('.ranked-item[aria-pressed="true"]').count() === 1, 'Keyboard ranked-list selection failed');
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await tree.first().locator('.node-card').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration) < .001), 'Reduced motion not respected');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert(await page.getByRole('button', { name: 'Replay case', exact: true }).isVisible(), 'Replay action missing');
  assert(await page.locator('.pane.right').getByRole('button',{name:'Confirm working dx',exact:true}).count()===0,'Tour gained live clinical action');
  await page.locator('.tree-node[data-hypothesis-id="'+expected.h+'"]').click();
  await page.locator('.pane.right').getByRole('tab',{name:/^Evidence/}).click();
  await page.locator('.canvas-toolbar').hover();
  await page.screenshot({path:'output/playwright/attribution-desktop.png'});
  await page.setViewportSize({width:900,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Tablet horizontal overflow');
  await page.setViewportSize({width:1440,height:1000});
  console.log('PASS: bidirectional previews, click hold, Escape, keyboard tree/list, counts, selected path, reduced motion, responsive layout, read-only tour');
}
