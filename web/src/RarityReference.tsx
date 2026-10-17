import type { Hypothesis } from './types.js';

export function rarityLabel(h: Hypothesis, illustrative = false): string | null {
  if (illustrative) return h.isZebra ? '🦓 zebra' : null;
  if (h.rarity?.classification === 'below_reference_threshold') return '🦓 Rare-range estimate · Orphadata';
  if (h.isZebra) return '🦓 Model-suggested uncommon option';
  return null;
}

export function RarityReference({ h }: { h: Hypothesis }) {
  const rarity = h.rarity;
  if (!rarity) return null;
  return <div className="rarity-reference">
    <strong>Published population frequency</strong>
    <p className="small">{rarity.records?.filter((r) => r.frequency).map((r) => `${r.frequency!.percentDisplay} (${r.geography})`).join("; ") || "Frequency unavailable"}</p>
    <p className="small">{rarity.classification === 'below_reference_threshold' ? 'Estimate below the rarity reference threshold'
      : rarity.classification === 'above_reference_threshold' ? 'Estimate above the rarity reference threshold' : 'Rarity unconfirmed'}</p>
    <p className="muted small">{rarity.reason}</p>
    {rarity.entity && <a className="cite" href={rarity.entity.url} target="_blank" rel="noreferrer">Orphanet: {rarity.entity.name} (ORPHA:{rarity.entity.orphaCode})</a>}
    {rarity.geography && <p className="muted small">Reference population: {rarity.geography} · Dataset release: {rarity.release}</p>}
    <p className="muted small">{rarity.geographyPolicy}</p>
    {(rarity.records?.filter((r) => r.frequency).length ?? 0) > 1 && <p className="small">Multiple published estimates: inspect each separately. Estimates may differ; no average was calculated.</p>}
    <p className="muted small">{h.populationContextUsed ? `Population context supplied to agent in round ${h.populationContextUsed.round}, pass ${h.populationContextUsed.pass} (${h.populationContextUsed.recordIds.length} records).` : 'Reference attached for review; no numeric population context supplied for this hypothesis in the displayed round.'}</p>
    {!!rarity.records?.length && <details>
      <summary>Frequency details: conversion, bounds and sources</summary>
      <p className="muted small">Dataset export: {rarity.exportDate ?? 'unknown'}. SHA-256: <code>{rarity.dataHash ?? 'unavailable'}</code></p>
      <ul>{(rarity.allEligibleRecords ?? rarity.records).map((record) => <li key={`${record.geography}-${record.id}`}>
        <strong>{record.frequency?.percentDisplay ?? "No numeric frequency"} - {record.geography}</strong>
        <div className="muted small">Record {record.id} / ORPHA:{rarity.entity?.orphaCode}. {h.populationContextUsed?.recordIds.includes(record.id) ? 'Supplied to agent in the displayed round.' : 'Additional reference; not supplied to agent in the displayed round.'}</div>
        <span>{record.metric}: {record.valuePer100000 === null ? `class ${record.prevalenceClass}; no exact value supplied` : `${record.valuePer100000} per 100,000 people`}</span>
        <div className="muted small">{record.frequency?.formula} {record.frequency?.rounding} {record.frequency?.boundsInclusivity} Formula version: {record.frequency?.formulaVersion}</div>
        <div className="muted small">Underlying study date: {record.studyDate ?? "unknown"}. Dataset release: {rarity.release ?? "unknown"}.</div>
        <div className="muted small">Curator status: {record.validationStatus}. {record.source}</div>
        {record.sourceUrls.map((url) => <a key={url} href={url} className="cite" target="_blank" rel="noreferrer">Underlying publication ↗ </a>)}
      </li>)}</ul>
    </details>}
    <p className="muted small">Agent ranking is ordinal. Patient likelihood is unquantified. Population frequency is separate from clinical urgency.</p>
    <details className="muted small"><summary>Data attribution</summary>
      Orphadata Science: Free access data from Orphanet. © INSERM 1999. Release {rarity.release ?? 'unavailable'}.{' '}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.
      {' '}Zebrio Diagnostic Clinical Decision Support derives these displays from Orphadata. Generated results may not reflect the source accurately; Orphanet/Orphadata is not responsible for generated outputs and does not endorse this application.
    </details>
  </div>;
}
