import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { evidenceRelation, type EvidenceRelation } from "./evidenceLinks.js";
import type { Case, Hypothesis } from "./types.js";

type Target = { kind: "hypothesis" | "finding"; id: string };
type Highlight = EvidenceRelation | "focused" | undefined;
interface Attribution {
  relation: (kind: Target["kind"], id: string) => Highlight;
  preview: (target: Target | null, channel: "pointer" | "keyboard") => void;
  hold: (target: Target) => void;
  release: () => void;
}
const AttributionContext = createContext<Attribution>({ relation: () => undefined, preview: () => {}, hold: () => {}, release: () => {} });

/** UI-only focus shared by the tree, findings and inspector, including old frames. */
export function EvidenceAttributionProvider({ c, selectedId, children }: { c: Case; selectedId: string | null; children: ReactNode }) {
  const [pointer, setPointer] = useState<Target | null>(null);
  const [keyboard, setKeyboard] = useState<Target | null>(null);
  const [held, setHeld] = useState<Target | null>(null);
  const [released, setReleased] = useState(false);
  useEffect(() => {
    setPointer(null); setKeyboard(null); setHeld(null); setReleased(false);
  }, [c.id, c.updatedAt, selectedId]);

  function release() { setPointer(null); setKeyboard(null); setHeld(null); setReleased(true); }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") release(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const target = pointer ?? keyboard ?? held ?? (!released && selectedId ? { kind: "hypothesis" as const, id: selectedId } : null);
  function relation(kind: Target["kind"], id: string): Highlight {
    if (!target) return undefined;
    if (kind === target.kind) return id === target.id ? "focused" : undefined;
    return (kind === "finding" ? evidenceRelation(c, target.id, id) : evidenceRelation(c, id, target.id)) ?? undefined;
  }
  return <AttributionContext.Provider value={{ relation, release,
    preview: (next, channel) => channel === "pointer" ? setPointer(next) : setKeyboard(next),
    hold: (next) => { setHeld(next); setReleased(false); },
  }}>{children}</AttributionContext.Provider>;
}

export const useEvidenceAttribution = () => useContext(AttributionContext);

export function EvidenceTally({ h }: { h: Hypothesis }) {
  return <span className="evidence-tally" aria-label={`${h.evidenceFor.length} supporting findings, ${h.evidenceAgainst.length} contradicting findings`}>
    <span className="tally-for">+{h.evidenceFor.length} for</span>
    <span className="tally-against">−{h.evidenceAgainst.length} against</span>
  </span>;
}
