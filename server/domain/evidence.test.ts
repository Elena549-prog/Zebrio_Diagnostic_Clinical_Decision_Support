import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase } from './case-factory.js';
import { applyEvidence } from './evidence.js';
import { capture } from './history.js';
import type { ExpertEvidenceResult } from '../experts/index.js';

const source = {ref:'N1',title:'Synthetic reference',url:'https://www.who.int/synthetic-test',type:'guideline',excerpt:'An exact synthetic supporting passage for testing only.',validationStatus:'supported' as const};

test('accepted literature keeps its source and validation status through case history', () => {
  const c = createCase({chiefComplaint:'Synthetic test only',demographics:{}});
  const evidence: ExpertEvidenceResult = {sources:[source],findings:[{summary:'Synthetic claim',sourceRefs:['N1'],validationStatus:'supported'}],status:'ready',limitations:[]};
  applyEvidence(c,evidence);
  assert.equal(c.findings[0]?.validationStatus,'supported');
  assert.deepEqual(c.findings[0]?.sourceIndices,[1]);
  assert.equal(c.sources[0]?.excerpt,source.excerpt);
  const frame=capture(c,'round','Synthetic evidence');
  assert.equal(frame.findings[0]?.validationStatus,'supported');
});

test('uncertain, contradicted, or unreviewed claims are not promoted to supported findings', () => {
  const c = createCase({chiefComplaint:'Synthetic test only',demographics:{}});
  applyEvidence(c,{sources:[source],findings:[
    {summary:'Insufficient claim',sourceRefs:['N1'],validationStatus:'insufficient'},
    {summary:'Contradicted claim',sourceRefs:['N1'],validationStatus:'contradicted'},
    {summary:'Unreviewed claim',sourceRefs:['N1']},
    {summary:'Dangling reference',sourceRefs:['N9'],validationStatus:'supported'},
  ],status:'partial',limitations:[]});
  assert.equal(c.findings.length,0);
});
