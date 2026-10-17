import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRarityLookup, type EpidemiologyRecord, type RarityEntity } from './rarity.js';

// Synthetic catalogue fixtures: test interpretation, not clinical accuracy.
const record = (changes: Partial<EpidemiologyRecord> = {}): EpidemiologyRecord => ({
  id: 'fixture-1', type: 'Point prevalence', qualification: 'Value and class',
  prevalenceClass: '1-5 / 10 000', rawValue: 11, geography: 'Germany',
  validationStatus: 'Validated', source: '123456[PMID]_ORPHANET', ...changes,
});
const entity = (changes: Partial<RarityEntity> = {}): RarityEntity => ({
  orphaCode: '999', names: { en: 'Fixture disease', de: 'Test-Krankheit' },
  url: 'https://www.orpha.net/en/disease/detail/999', group: 'Disorder',
  type: 'Disease', records: [record()], ...changes,
});
const lookup = (...entities: RarityEntity[]) => createRarityLookup(entities, { release: 'fixture', dataHash: 'fixture-hash' });

test('exact bilingual names and ORPHA identifiers preserve source provenance', () => {
  const find = lookup(entity());
  for (const name of ['Fixture disease', 'test krankheit', 'ORPHA:999']) {
    const result = find(name);
    assert.equal(result.classification, 'below_reference_threshold');
    assert.equal(result.geography, 'Germany');
    assert.equal(result.dataHash, 'fixture-hash');
    assert.equal(result.records?.[0]?.valuePer100000, 11);
    assert.deepEqual(result.records?.[0]?.sourceUrls, ['https://pubmed.ncbi.nlm.nih.gov/123456/']);
  }
  assert.equal(find('possible Fixture disease').status, 'unknown');
});

test('ambiguous names and groups cannot establish individual disease rarity', () => {
  assert.equal(lookup(entity(), entity({ orphaCode: '998' }))('Fixture disease').status, 'unknown');
  assert.equal(lookup(entity({ group: 'Group of disorders' }))('ORPHA:999').classification, 'uncertain');
});

test('Germany takes precedence over Europe; incompatible metrics and unvalidated records are excluded', () => {
  const find = lookup(entity({ records: [
    record({ geography: 'Europe', rawValue: 100 }), record({ rawValue: 10 }),
    record({ type: 'Birth prevalence', rawValue: 1000 }),
    record({ validationStatus: 'Not yet validated', rawValue: 1000 }),
  ] }));
  const result = find('ORPHA:999');
  assert.equal(result.classification, 'below_reference_threshold');
  assert.equal(result.records?.length, 1);
  const fallback = lookup(entity({ records: [record({ geography: 'Europe', rawValue: 10 })] }))('ORPHA:999');
  assert.equal(fallback.geography, 'Europe');
  for (const changes of [{ geography: 'Worldwide' }, { type: 'Annual incidence' }, { type: 'Birth prevalence' }, { validationStatus: 'Not yet validated' }]) {
    assert.equal(lookup(entity({ records: [record(changes)] }))('ORPHA:999').classification, 'uncertain');
  }
});

test('class-only zero is missing, not zero prevalence; bounds and boundary remain explicit', () => {
  const check = (prevalenceClass: string) => lookup(entity({ records: [record({ qualification: 'Class only', rawValue: 0, prevalenceClass })] }))('ORPHA:999');
  assert.equal(check('<1 / 1 000 000').classification, 'below_reference_threshold');
  assert.equal(check('<1 / 1 000 000').records?.[0]?.valuePer100000, null);
  assert.equal(check('1-5 / 10 000').classification, 'uncertain');
  assert.equal(check('1-9 / 1 000 000').classification, 'below_reference_threshold');
  assert.equal(check('>1 / 1 000').classification, 'above_reference_threshold');
  assert.equal(check('Unknown').classification, 'uncertain');
  assert.equal(lookup(entity({ records: [record({ rawValue: 50 })] }))('ORPHA:999').classification, 'uncertain');
});

test('conflicting eligible estimates remain uncertain and are not averaged', () => {
  const result = lookup(entity({ records: [record({ rawValue: 10 }), record({ id: 'fixture-2', rawValue: 90 })] }))('ORPHA:999');
  assert.equal(result.classification, 'uncertain');
  assert.equal(result.records?.length, 2);
});


import { populationFrequency } from './rarity.js';
test('deterministic percentages preserve exact input, bounds, unknowns and conflicts', () => {
  const exact = populationFrequency(record({ rawValue: 11.1954 }))!;
  assert.equal(exact.lowerPer100000, 11.1954);
  assert.equal(exact.percentDisplay, '0.0112% (approx.)');
  assert.match(exact.formula, /11.1954 per 100,000 \/ 1,000/);
  assert.equal(exact.formulaVersion, 'population-percent-v1');
  const band = populationFrequency(record({ qualification: 'Class only', rawValue: 0, prevalenceClass: '1-9 / 1 000 000' }))!;
  assert.equal(band.kind, 'range');
  assert.equal(band.lowerPer100000, 0.1);
  assert.equal(band.upperPer100000, 0.9);
  assert.equal(band.percentDisplay, '0.0001 to 0.0009%');
  const less = populationFrequency(record({ qualification: 'Class only', prevalenceClass: '<1 / 1 000 000' }))!;
  assert.equal(less.kind, 'less_than');
  assert.equal(less.lowerPer100000, undefined);
  assert.equal(less.percentDisplay, '<0.0001%');
  assert.equal(populationFrequency(record({ qualification: 'Unknown' })), undefined);
  assert.equal(populationFrequency(record({ qualification: 'Class only', rawValue: 0, prevalenceClass: 'Unknown' })), undefined);
  const result = lookup(entity({ records: [record(), record({ id: 'europe', geography: 'Europe', rawValue: 40 })] }))('ORPHA:999');
  assert.equal(result.records?.length, 1);
  assert.equal(result.allEligibleRecords?.length, 2);
  assert.equal(result.records?.[0]?.studyDate, null);
  assert.match(result.geographyPolicy!, /not matched to patient location/);
});
