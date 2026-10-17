import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { Case, RarityAssessment, PopulationFrequency, RarityRecord } from './types.js';

export interface EpidemiologyRecord {
  id: string; type: string; qualification: string; prevalenceClass: string;
  rawValue: number | null; geography: string; validationStatus: string; source: string;
}
export interface RarityEntity {
  orphaCode: string; names: { en: string; de: string }; url: string;
  group: string; type: string; records: EpidemiologyRecord[];
}
interface ReferenceManifest {
  schemaVersion: number; orphadataRelease: string; orphadataExportDate: string;
  rkiCommit: string; rkiRows: number; entityCount: number;
  processedFiles: { name: string; sha256: string }[];
  artifacts: { name: string; url: string; license: string; sha256: string }[];
  sources: { orphadata: string; rki: string };
}
const normalize = (name: string) => name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Conversion only: published population frequency is never a patient prior. */
export function populationFrequency(record: EpidemiologyRecord): PopulationFrequency | undefined {
  if (!['value and class', 'class only'].includes(record.qualification.toLowerCase())) return undefined;
  const rounding = 'Display rounded to 4 significant digits; trailing zeros removed. Bounds retained; no midpoint.';
  const display = (value: number) => Number(value.toPrecision(4)).toString();
  if (record.qualification.toLowerCase() === 'value and class' && record.rawValue !== null && Number.isFinite(record.rawValue) && record.rawValue > 0) {
    return { kind: 'exact', formulaVersion: 'population-percent-v1', boundsInclusivity: 'Exact reported value', lowerPer100000: record.rawValue, upperPer100000: record.rawValue,
      percentDisplay: `${display(record.rawValue / 1000)}% (approx.)`, formula: `${record.rawValue} per 100,000 / 1,000 = ${record.rawValue / 1000}% before display rounding`, rounding };
  }
  const band = record.prevalenceClass.replace(/\s/g, '').replace(/[\u2013\u2014]/g, '-');
  const match = band.match(/^(<|>)?(\d+)(?:-(\d+))?\/(\d+)$/);
  if (!match) return undefined;
  const denominator = Number(match[4]);
  if (!(denominator > 0)) return undefined;
  const lower = Number(match[2]) * 100000 / denominator;
  const upper = match[3] ? Number(match[3]) * 100000 / denominator : lower;
  if (lower > upper) return undefined;
  const kind = match[1] === '<' ? 'less_than' : match[1] === '>' ? 'greater_than' : match[3] ? 'range' : undefined;
  if (!kind) return undefined;
  const boundsRounding = 'Bounds displayed without rounding; inequality direction and endpoint values retained. No midpoint.';
  return { kind, formulaVersion: 'population-percent-v1', boundsInclusivity: kind === 'range' ? 'Range endpoint inclusivity unspecified by source' : 'Strict inequality as published', ...(kind !== 'less_than' ? { lowerPer100000: lower } : {}), ...(kind !== 'greater_than' ? { upperPer100000: upper } : {}),
    percentDisplay: kind === 'range' ? `${lower / 1000} to ${upper / 1000}%` : `${match[1]}${lower / 1000}%`,
    formula: `${record.prevalenceClass}: each bound / ${denominator} * 100,000 gives per 100,000; each bound per 100,000 / 1,000 gives percent. Converted: ${kind === 'range' ? `${lower} to ${upper}` : `${match[1]}${lower}`} per 100,000; percent ${kind === 'range' ? `${lower / 1000} to ${upper / 1000}` : `${match[1]}${lower / 1000}`}%.`, rounding: boundsRounding };
}
function referenceRecord(record: EpidemiologyRecord): RarityRecord {
  return { id: record.id, metric: record.type, geography: record.geography, prevalenceClass: record.prevalenceClass,
    valuePer100000: record.qualification.toLowerCase() === 'value and class' && record.rawValue !== null && Number.isFinite(record.rawValue) && record.rawValue > 0 ? record.rawValue : null,
    validationStatus: record.validationStatus, source: record.source,
    sourceUrls: [...record.source.matchAll(/(\d+)\s*\[PMID\]/g)].map((match) => `https://pubmed.ncbi.nlm.nih.gov/${match[1]}/`),
    studyDate: null, frequency: populationFrequency(record) };
}

/** Strictly below 50/100,000. Boundary/straddling/unknown bands remain uncertain. */
function classify(record: EpidemiologyRecord): RarityAssessment['classification'] {
  const frequency = populationFrequency(record);
  if (!frequency) return 'uncertain';
  const { kind, lowerPer100000: lower, upperPer100000: upper } = frequency;
  if (kind === 'less_than' && upper !== undefined && upper <= 50) return 'below_reference_threshold';
  if (kind === 'greater_than' && lower !== undefined && lower >= 50) return 'above_reference_threshold';
  if (upper !== undefined && upper < 50) return 'below_reference_threshold';
  if (lower !== undefined && lower > 50) return 'above_reference_threshold';
  return 'uncertain';
}

export function createRarityLookup(entities: RarityEntity[], metadata: { release: string; dataHash: string }) {
  const names = new Map<string, RarityEntity[]>();
  const codes = new Map(entities.map((entity) => [entity.orphaCode, entity]));
  for (const entity of entities) for (const name of new Set(Object.values(entity.names).filter(Boolean).map(normalize))) {
    names.set(name, [...(names.get(name) ?? []), entity]);
  }
  return (query: string): RarityAssessment => {
    const code = query.trim().match(/^ORPHA:(\d+)$/i)?.[1];
    const candidates = code ? [codes.get(code)].filter((entity): entity is RarityEntity => Boolean(entity)) : names.get(normalize(query)) ?? [];
    if (candidates.length !== 1) return { status: 'unknown', reason: candidates.length ? 'Disease name is ambiguous; no rarity was assigned.' : 'No exact English/German catalogue name match. Absence does not establish commonness.', ...metadata };
    const entity = candidates[0]!;
    const identity = { orphaCode: entity.orphaCode, name: entity.names.en, url: entity.url };
    if (!['Disorder', 'Subtype of disorder'].includes(entity.group)) return { status: 'matched', classification: 'uncertain', entity: identity, reason: 'This is a group/category, not an individual disease match.', ...metadata };
    const eligible = entity.records.filter((record) => record.type === 'Point prevalence' && record.validationStatus === 'Validated');
    const germany = eligible.filter((record) => record.geography === 'Germany');
    const europe = eligible.filter((record) => record.geography === 'Europe');
    const selected = germany.length ? germany : europe;
    const classifications = selected.map(classify);
    const classification = classifications.length && classifications.every((value) => value === 'below_reference_threshold') ? 'below_reference_threshold'
      : classifications.length && classifications.every((value) => value === 'above_reference_threshold') ? 'above_reference_threshold' : 'uncertain';
    return {
      status: 'matched', classification, entity: identity, geography: selected[0]?.geography,
      ...metadata,
      reason: !selected.length ? 'No curator-validated Germany/Europe point-prevalence estimate is available. Incidence, birth prevalence and case counts were not substituted.'
        : classification === 'uncertain' ? 'Estimates are mixed, unknown, or cross/touch the 50 per 100,000 reference boundary.'
        : 'Orphadata population estimate relative to 50 per 100,000. This is not patient risk or clinical validation; source periods and applicability require review.',
      records: selected.map(referenceRecord),
      allEligibleRecords: eligible.filter((r) => ['Germany', 'Europe'].includes(r.geography)).map(referenceRecord),
      geographyPolicy: germany.length ? 'Germany reference selected; not matched to patient location.' : 'Europe fallback reference; not matched to patient location.',

    };
  };
}

function referenceDirectory() {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth++) {
    const packageFile = path.join(directory, 'package.json');
    if (fs.existsSync(packageFile) && JSON.parse(fs.readFileSync(packageFile, 'utf8')).name === 'arbor-claude') return path.join(directory, 'data/reference');
    directory = path.dirname(directory);
  }
  throw new Error('Reference-data directory not found');
}
let cache: { stamp: number; manifest: ReferenceManifest; lookup: ReturnType<typeof createRarityLookup>; directory: string } | undefined;
function loadReferences() {
  const directory = referenceDirectory();
  const file = path.join(directory, 'manifest.json');
  const stamp = fs.statSync(file).mtimeMs;
  if (cache?.stamp === stamp) return cache;
  const manifest: ReferenceManifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const buffer = fs.readFileSync(path.join(directory, 'orphadata-index.json'));
  const hash = createHash('sha256').update(buffer).digest('hex');
  if (manifest.schemaVersion !== 1 || hash !== manifest.processedFiles.find((item) => item.name === 'orphadata-index.json')?.sha256) throw new Error('Reference-data integrity check failed');
  const index = JSON.parse(buffer.toString('utf8'));
  if (index.schemaVersion !== 1 || !Array.isArray(index.entities)) throw new Error('Invalid reference index');
  cache = { stamp, directory, manifest, lookup: createRarityLookup(index.entities, { release: manifest.orphadataRelease, dataHash: hash }) };
  return cache;
}
export function lookupRarity(query: string): RarityAssessment {
  try { return loadReferences().lookup(query); }
  catch { return { status: 'unavailable', reason: 'Local reference data missing or invalid. Run npm run data:sync from the repository root.' }; }
}
export function referenceDataStatus() {
  try {
    const { manifest, directory } = loadReferences();
    return { status: 'ready', orphadata: { release: manifest.orphadataRelease, exportDate: manifest.orphadataExportDate, entities: manifest.entityCount, url: manifest.sources.orphadata },
      rki: { status: fs.existsSync(path.join(directory, 'raw/rki-ncd.tsv')) ? 'downloaded' : 'missing', commit: manifest.rkiCommit, rows: manifest.rkiRows, url: manifest.sources.rki, use: 'Local population-frequency reference only; not used to score or diagnose patients.' },
      license: 'CC BY 4.0', patientProbabilities: 'unavailable' };
  } catch { return { status: 'unavailable', reason: 'Run npm run data:sync from the repository root.', patientProbabilities: 'unavailable' }; }
}
export function annotateRarity(c: Case): void {
  for (const hypothesis of Object.values(c.hypotheses)) {
    if (hypothesis.modelSuggestedZebra === undefined && !hypothesis.rarity) hypothesis.modelSuggestedZebra = hypothesis.isZebra === true;
    hypothesis.rarity = lookupRarity(hypothesis.name);
    if (hypothesis.rarity.classification === 'below_reference_threshold') hypothesis.isZebra = true;
    else if (hypothesis.rarity.classification === 'above_reference_threshold') hypothesis.isZebra = false;
    else hypothesis.isZebra = hypothesis.modelSuggestedZebra === true;
  }
}
