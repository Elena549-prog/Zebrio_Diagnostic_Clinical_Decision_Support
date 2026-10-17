import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Cited, SourceChips } from "./Cite.js";
import { probabilityLabel, probabilityMode } from "./probabilityDisplay.js";
import { RarityReference, rarityLabel } from "./RarityReference.js";
import { EvidenceTally, useEvidenceAttribution } from "./EvidenceAttributionUI.js";
import type { Case, Hypothesis } from "./types.js";

type Tab = "overview" | "evidence" | "reference";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "reference", label: "Reference" },
];

/** Existing hypothesis fields, reorganized without generating clinical summaries. */
export function HypothesisDetails({ c, h }: { c: Case; h: Hypothesis }) {
  const attribution = useEvidenceAttribution();
  const [tab, setTab] = useState<Tab>("overview");
  const [descOpen, setDescOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const ordinalIndex = Object.values(c.hypotheses)
    .filter((candidate) => candidate.status === "live" || candidate.status === "branched")
    .sort((a, b) => b.probability - a.probability)
    .findIndex((candidate) => candidate.id === h.id);
  const label = rarityLabel(h, probabilityMode(c) === "illustrative");
  const codes = (h.codes ?? []).filter((code) => code && code.system && code.code);
  const count = h.evidenceFor.length + h.evidenceAgainst.length;

  // The parent keys this view by hypothesis, resetting its tab and expansion.
  useEffect(() => {
    const scroll = root.current?.closest(".detail-panel");
    if (scroll) scroll.scrollTop = 0;
  }, []);

  function selectTab(next: Tab, focus = false) {
    setTab(next);
    if (focus) tabButtons.current[TABS.findIndex((item) => item.id === next)]?.focus();
    const scroll = root.current?.closest(".detail-panel");
    if (scroll) scroll.scrollTop = 0;
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    selectTab(TABS[next]!.id, true);
  }

  function evidenceItems(items: Hypothesis["evidenceFor"], direction: "supports" | "against") {
    return <ul className="hypothesis-evidence-list">{items.map((item, index) => {
      const finding = c.findings.find((candidate) => candidate.id === item.findingId);
      return <li key={`${item.findingId}-${index}`} className={direction}
        data-attribution={attribution.relation("finding", item.findingId)}
        data-finding-id={item.findingId}
        onPointerEnter={() => attribution.preview({ kind: "finding", id: item.findingId }, "pointer")}
        onPointerLeave={() => attribution.preview(null, "pointer")}
        onFocus={() => attribution.preview({ kind: "finding", id: item.findingId }, "keyboard")}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) attribution.preview(null, "keyboard"); }}
        onClick={() => attribution.hold({ kind: "finding", id: item.findingId })}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault(); event.stopPropagation();
            attribution.hold({ kind: "finding", id: item.findingId });
          }
        }}
        tabIndex={0}
      >
        {finding?.hypothetical && <span className="hypothetical-badge">Hypothetical</span>}
        <Cited text={finding?.summary || item.weight} sources={c.sources} />
        <SourceChips ids={finding?.sourceIndices} sources={c.sources} />
      </li>;
    })}</ul>;
  }

  const firstAgainst = h.evidenceAgainst[0];
  const firstFinding = firstAgainst ? c.findings.find((finding) => finding.id === firstAgainst.findingId) : undefined;

  return <div className="hypothesis-details" ref={root} onKeyDown={(event) => {
    // Timeline shortcuts must not also fire while operating this inspector.
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.stopPropagation();
  }}>
    <header className="hypothesis-heading">
      <p className="hypothesis-kicker">Selected hypothesis · Round {c.round}</p>
      <div className="hypothesis-title-row">
        <h3>{h.name}</h3>
        <span className={`status-chip ${h.status}`}>{h.status}</span>
      </div>
      <div className="hypothesis-tags">
        {probabilityMode(c) !== "illustrative" && ordinalIndex >= 0 && <span className="hypothesis-rank">Agent rank #{ordinalIndex + 1} (model judgment)</span>}
        {label && <span className="zebra-tag">{label}</span>}
        <EvidenceTally h={h} />
      </div>
      <p className="small muted hypothesis-probability">{probabilityMode(c, h) === "unavailable" ? "Clinical probability" : "Probability"}: <b>{probabilityLabel(c, h)}</b></p>
    </header>

    <div className="hypothesis-nav">
      <div className={`hypothesis-concern ${firstAgainst ? "has-concern" : ""}`}>
        {firstAgainst ? <>
          <button className="hypothesis-concern-link" onClick={() => selectTab("evidence", true)}>
            {h.evidenceAgainst.length} contradicting {h.evidenceAgainst.length === 1 ? "finding" : "findings"} · View evidence
          </button>
          <div className="hypothesis-concern-summary">
            {firstFinding?.hypothetical && <span className="hypothetical-badge">Hypothetical</span>}
            <Cited text={firstFinding?.summary || firstAgainst.weight} sources={c.sources} />
            <SourceChips ids={firstFinding?.sourceIndices} sources={c.sources} />
          </div>
        </> : <span>No contradicting evidence recorded</span>}
      </div>
      <div className="hypothesis-tabs" role="tablist" aria-label={`Information about ${h.name}`}>
        {TABS.map((item, index) => <button
          key={item.id}
          ref={(element) => { tabButtons.current[index] = element; }}
          id={`${id}-tab-${item.id}`}
          className="hypothesis-tab"
          role="tab"
          aria-selected={tab === item.id}
          aria-controls={`${id}-panel-${item.id}`}
          tabIndex={tab === item.id ? 0 : -1}
          onClick={() => selectTab(item.id)}
          onKeyDown={(event) => handleTabKey(event, index)}
        >{item.label}{item.id === "evidence" && <span className="hypothesis-tab-count"> {count}</span>}</button>)}
      </div>
    </div>

    <div className="hypothesis-tabpanel" role="tabpanel" id={`${id}-panel-overview`} aria-labelledby={`${id}-tab-overview`} tabIndex={0} hidden={tab !== "overview"}>
      {h.description && <section className="hypothesis-widget">
        <h4>Why it is on the tree</h4>
        <p className={`hypo-desc ${descOpen ? "open" : "clamp"}`}><Cited text={h.description} sources={c.sources} /></p>
        <button className="desc-toggle" aria-expanded={descOpen} onClick={() => setDescOpen(!descOpen)}>{descOpen ? "show less" : "show more"}</button>
      </section>}
      <section className="hypothesis-widget hypothesis-against">
        <h4>What challenges it</h4>
        {h.evidenceAgainst.length ? evidenceItems(h.evidenceAgainst, "against") : <p className="small muted">No contradicting evidence recorded.</p>}
        <button className="hypothesis-text-button" onClick={() => selectTab("evidence", true)}>Inspect all evidence ({count}) →</button>
      </section>
      {!!h.discriminatingTests?.length && <section className="hypothesis-widget hypothesis-next-tests">
        <h4>What would help decide</h4>
        <ul>{h.discriminatingTests.map((test) => <li key={test.id}>
          <strong>{test.name}</strong>
          <p className="small muted"><Cited text={test.rationale} sources={c.sources} /></p>
        </li>)}</ul>
      </section>}
    </div>

    <div className="hypothesis-tabpanel" role="tabpanel" id={`${id}-panel-evidence`} aria-labelledby={`${id}-tab-evidence`} tabIndex={0} hidden={tab !== "evidence"}>
      <section className="hypothesis-widget hypothesis-against">
        <h4>Contradicting evidence · {h.evidenceAgainst.length}</h4>
        {h.evidenceAgainst.length ? evidenceItems(h.evidenceAgainst, "against") : <p className="small muted">No contradicting evidence recorded.</p>}
      </section>
      <section className="hypothesis-widget">
        <h4>Supporting evidence · {h.evidenceFor.length}</h4>
        {h.evidenceFor.length ? evidenceItems(h.evidenceFor, "supports") : <p className="small muted">No supporting evidence recorded.</p>}
      </section>
    </div>

    <div className="hypothesis-tabpanel" role="tabpanel" id={`${id}-panel-reference`} aria-labelledby={`${id}-tab-reference`} tabIndex={0} hidden={tab !== "reference"}>
      <RarityReference h={h} />
      {!h.rarity && <section className="hypothesis-widget"><h4>Population reference</h4><p className="small muted">No population reference attached.</p></section>}
      {h.baseRateNote && <section className="hypothesis-widget">
        <h4>Base-rate context</h4>
        <p className="small muted"><Cited text={h.baseRateNote} sources={c.sources} /></p>
      </section>}
      <section className="hypothesis-widget codes">
        <h4>Codes</h4>
        {codes.length ? <ul>{codes.map((code, index) => <li key={index}>
          {code.system}: <code>{code.code}</code> {code.display}
          {code.url && <a className="cite" href={code.url} target="_blank" rel="noreferrer"> Official reference</a>}
          {code.reasoning && <div className="muted small">{code.reasoning}</div>}
        </li>)}</ul> : <p className="small muted">No code suggestion attached.</p>}
      </section>
    </div>
  </div>;
}
