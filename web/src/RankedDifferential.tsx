/**
 * RankedDifferential — the live differential as a ranked list view, offered as
 * a toggle against the SVG tree (DecisionTree). Same data, different lens:
 * here the hypotheses read top-to-bottom by probability, each with its zebra
 * tag, base-rate note, and a chevron to open it in the right-hand DetailPanel.
 *
 * Both views share the same `onSelect`, so selecting a hypothesis here or in the
 * tree opens the same detail.
 */

import type { Case, Hypothesis } from "./types.js";
import { probabilityLabel } from "./probabilityDisplay.js";
import { rarityLabel } from './RarityReference.js';

interface Props {
  c: Case;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

export function RankedDifferential({ c, selectedId, onSelect }: Props) {
  const live = Object.values(c.hypotheses)
    .filter((h) => h.status === "live" || h.status === "branched")
    .sort((a, b) => b.probability - a.probability);

  const ruledOut = Object.values(c.hypotheses).filter((h) => h.status === "ruled_out");

  return (
    <div className="ranked-scroll">
      {live.length === 0 && (
        <p className="muted">Advance a round to generate the differential.</p>
      )}
      <ol className="ranked-list">
        {live.map((h: Hypothesis, i: number) => (
          <li
            key={h.id}
            className={`ranked-item ${selectedId === h.id ? "sel" : ""} ${h.status === "branched" ? "branched" : ""}`}
            onClick={() => onSelect(h.id)}
          >
            <div className="ranked-rank">{i + 1}</div>
            <div className="ranked-body">
              <div className="ranked-top">
                <span className="ranked-name">{h.name}</span>
                <span className="ranked-pct">{probabilityLabel(c, h)}</span>
              </div>
              <div className="ranked-bar" title="Relative ranking weight; see the probability notice above" aria-hidden="true">
                <div className="ranked-bar-fill" style={{ width: `${Math.max(h.probability * 100, 3)}%` }} />
              </div>
              {rarityLabel(h, c.probabilityMode === 'illustrative') && <span className="zebra-tag">{rarityLabel(h, c.probabilityMode === 'illustrative')}</span>}
              {h.baseRateNote && <div className="ranked-baserate muted small">{h.baseRateNote}</div>}
              {h.status === "branched" && <div className="ranked-flag muted small">branched into children</div>}
            </div>
          </li>
        ))}
      </ol>

      {ruledOut.length > 0 && (
        <div className="ranked-ruledout">
          <div className="ranked-ruledout-head muted small">Ruled out (kept for the trail)</div>
          <ul>
            {ruledOut.map((h) => (
              <li key={h.id} className={`ruled-item ${selectedId === h.id ? "sel" : ""}`} onClick={() => onSelect(h.id)}>
                <span className="ruled-name">{h.name}</span>
                {rarityLabel(h, c.probabilityMode === 'illustrative') && <span className="zebra-tag" title={rarityLabel(h, c.probabilityMode === 'illustrative')!}>🦓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
