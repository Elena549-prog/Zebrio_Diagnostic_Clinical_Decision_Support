/**
 * DecisionTree — the headline visualization: a retraceable tree of hypotheses
 * on a freehand diagnostic canvas.
 *
 * The canvas is a real pan/zoom surface:
 *   - Drag a node to reposition it. Only nodes you actually drag are pinned;
 *     everything else keeps following the tidy layout, so when the engine adds
 *     a branch the tree re-tidies around your pinned nodes instead of freezing
 *     in its first shape.
 *   - Drag empty canvas to pan. Wheel (or the +/− buttons) to zoom. "Fit"
 *     frames the whole tree; "Reset layout" un-pins every node and refits.
 *   - Edge labels (the finding that caused a branch) render as small chips on
 *     the edge midpoint, so they never overlap the connector line.
 *
 * Nodes are HTML cards (foreignObject) so the hypothesis name wraps fully and
 * the card grows to fit the text. Color encodes status (live = blue, branched =
 * slate, confirmed = green, ruled_out = dimmed + struck through); the leading
 * live hypothesis gets the primary "focus" fill. Ruled-out branches stay on the
 * canvas (retraceable).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Case, Hypothesis } from "./types.js";
import { probabilityLabel } from "./probabilityDisplay.js";
import { EvidenceTally, useEvidenceAttribution } from "./EvidenceAttributionUI.js";

interface LayoutNode {
  h: Hypothesis;
  x: number;
  y: number;
  depth: number;
  parentId?: string;
  parent?: LayoutNode;
  edgeLabel?: string;
  isNew?: boolean;
}

/** Min node size; cards grow wider/taller to fit their text (foreignObject). */
const NODE_W = 240;
const NODE_H = 88;
const GAP_X = 160;
const GAP_Y = 36;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const ROOT_ID = "__root__";

/* ------------------------------------------------------------------ *
 * Per-case pin store.
 *
 * Only positions the user explicitly dragged are stored, keyed by hypothesis
 * id and nested under the case id. Everything else is laid out by `tidyLayout`
 * on every render, so a new branch re-tidies the tree around the pinned nodes.
 * ------------------------------------------------------------------ */
const pinsByCase: Record<string, Record<string, { x: number; y: number }>> = {};

function getPins(caseId: string): Record<string, { x: number; y: number }> {
  if (!pinsByCase[caseId]) pinsByCase[caseId] = {};
  return pinsByCase[caseId]!;
}

/** Tidy tree layout: x by depth, y by in-order leaf position. */
function tidyLayout(c: Case): LayoutNode[] {
  const nodes: LayoutNode[] = [];
  const presentationNode: LayoutNode = {
    h: {
      id: ROOT_ID,
      name: c.presentation.chiefComplaint,
      probability: 1,
      status: "branched",
      parentId: null,
      childIds: c.rootHypothesisIds,
      evidenceFor: [],
      evidenceAgainst: [],
      createdAt: "",
      updatedAt: "",
      description: "Presentation",
    },
    x: 0,
    y: 0,
    depth: 0,
  };

  let maxDepth = 0;
  let leafIdx = 0;

  const assign = (ln: LayoutNode, depth: number) => {
    ln.depth = depth;
    maxDepth = Math.max(maxDepth, depth);
    const childIds = ln.h.childIds;
    if (!childIds.length) {
      ln.y = leafIdx * (NODE_H + GAP_Y);
      leafIdx += 1;
      nodes.push(ln);
      return;
    }
    const children = childIds
      .map((id) => c.hypotheses[id])
      .filter((x): x is Hypothesis => !!x)
      .sort((a, b) => b.probability - a.probability)
      .map(
        (h) =>
          ({
            h,
            x: 0,
            y: 0,
            depth: depth + 1,
            parentId: ln.h.id,
            edgeLabel: h.branchedBecause || undefined,
          }) as LayoutNode,
      );
    for (const ch of children) assign(ch, depth + 1);
    const first = children[0];
    const last = children[children.length - 1];
    if (first && last) ln.y = (first.y + last.y) / 2;
    nodes.push(ln);
  };
  assign(presentationNode, 0);

  for (const n of nodes) n.x = n.depth * (NODE_W + GAP_X);
  return nodes;
}

interface Layout {
  nodes: LayoutNode[];
  bounds: { x: number; y: number; w: number; h: number };
}

/**
 * Build the render layout: tidy positions, overridden by the user's pins.
 *
 * Parent links are resolved *after* the overrides are applied, so an edge is
 * always drawn from where its parent card actually is. (Resolving them before
 * was the bug that left the root card in one place and its edges hanging in
 * empty space.)
 */
function buildLayout(c: Case, freshIds: Set<string>): Layout {
  const pins = getPins(c.id);
  const nodes = tidyLayout(c).map((n) => {
    const pin = pins[n.h.id];
    return {
      ...n,
      x: pin ? pin.x : n.x,
      y: pin ? pin.y : n.y,
      isNew: freshIds.has(n.h.id),
    };
  });

  const byId = new Map(nodes.map((n) => [n.h.id, n]));
  for (const n of nodes) if (n.parentId) n.parent = byId.get(n.parentId);

  // drop pins for nodes that no longer exist
  for (const id of Object.keys(pins)) if (!byId.has(id)) delete pins[id];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + NODE_H);
  }
  if (!nodes.length) { minX = minY = 0; maxX = NODE_W; maxY = NODE_H; }
  return { nodes, bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

function statusColor(h: Hypothesis): { fill: string; stroke: string; text: string; dim: boolean } {
  if (h.id === ROOT_ID) return { fill: "var(--on-surface)", stroke: "var(--on-surface)", text: "#ffffff", dim: false };
  switch (h.status) {
    case "confirmed":
      return { fill: "var(--confirmed-container)", stroke: "var(--confirmed)", text: "var(--confirmed)", dim: false };
    case "live":
      return { fill: "var(--primary-fixed)", stroke: "var(--primary)", text: "var(--on-primary-fixed)", dim: false };
    case "branched":
      return { fill: "var(--surface-container-low)", stroke: "var(--branched)", text: "var(--on-surface-variant)", dim: false };
    case "ruled_out":
      return { fill: "var(--surface-container)", stroke: "var(--outline-variant)", text: "var(--outline)", dim: true };
    default:
      return { fill: "#ffffff", stroke: "var(--outline-variant)", text: "var(--on-surface-variant)", dim: false };
  }
}

interface Props {
  c: Case;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

interface ViewTransform { tx: number; ty: number; k: number }

export function DecisionTree({ c, selectedId, onSelect }: Props) {
  const attribution = useEvidenceAttribution();
  const nodeIds = Object.keys(c.hypotheses).sort().join(",");

  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((t) => t + 1), []);

  // Ids that appeared with *this* node set — the ones worth animating in. This
  // recomputes only when the node set changes, so it survives the re-renders a
  // node drag causes.
  const seenIds = useRef<Set<string>>(new Set());
  const freshIds = useMemo(() => {
    const current = new Set([ROOT_ID, ...Object.keys(c.hypotheses)]);
    const fresh = new Set([...current].filter((id) => !seenIds.current.has(id)));
    seenIds.current = current;
    return fresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, nodeIds]);

  // Layout is derived from the case plus the pin store (which lives outside
  // React), so it is recomputed on every render rather than memoized — it is a
  // few dozen nodes, and memoizing it against mutable external state is how the
  // stale-parent bug got in.
  const { nodes, bounds } = buildLayout(c, freshIds);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const [view, setView] = useState<ViewTransform>({ tx: 0, ty: 0, k: 1 });
  // Once the user pans/zooms/drags we stop auto-fitting on every change.
  const touched = useRef(false);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const cw = el.clientWidth - 48;
    const ch = el.clientHeight - 48;
    if (cw <= 0 || ch <= 0) return;
    const k = Math.max(MIN_SCALE, Math.min(1, Math.min(cw / bounds.w, ch / bounds.h)));
    setView({
      tx: 24 + (cw - bounds.w * k) / 2 - bounds.x * k,
      ty: 24 + (ch - bounds.h * k) / 2 - bounds.y * k,
      k,
    });
  }, [bounds.x, bounds.y, bounds.w, bounds.h]);

  // Fit on first paint of a case, and re-fit as the tree grows — until the
  // user takes the canvas over by panning, zooming or dragging a node.
  useLayoutEffect(() => {
    if (!touched.current) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, nodeIds, fit]);

  // A brand-new case starts from a clean view.
  useEffect(() => {
    touched.current = false;
  }, [c.id]);

  // Keep the tree framed when the pane resizes (window resize, panes stacking
  // on a narrow viewport) — unless the user has taken the canvas over.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!touched.current) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  /** Client point → canvas coordinates (accounts for pan + zoom). */
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const g = gRef.current;
    if (!g) return { x: clientX, y: clientY };
    const ctm = g.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svg = g.ownerSVGElement!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }, []);

  // ---- node drag ----
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  // A drag that actually moved must not also select the node on the trailing
  // click. The flag outlives the drag by exactly one click.
  const suppressClick = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  // ---- canvas pan ----
  const pan = useRef<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);

  function onNodePointerDown(e: React.PointerEvent, n: LayoutNode) {
    if (n.h.id === ROOT_ID) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const loc = toCanvas(e.clientX, e.clientY);
    suppressClick.current = false;
    drag.current = { id: n.h.id, dx: loc.x - n.x, dy: loc.y - n.y, moved: false };
    setDragId(n.h.id);
  }

  function onSurfacePointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag.current) {
      const d = drag.current;
      const loc = toCanvas(e.clientX, e.clientY);
      d.moved = true;
      touched.current = true;
      getPins(c.id)[d.id] = { x: loc.x - d.dx, y: loc.y - d.dy };
      rerender();
      return;
    }
    if (pan.current) {
      const dx = e.clientX - pan.current.x;
      const dy = e.clientY - pan.current.y;
      pan.current = { x: e.clientX, y: e.clientY };
      touched.current = true;
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  }

  function onPointerUp() {
    if (drag.current) {
      suppressClick.current = drag.current.moved;
      drag.current = null;
    }
    setDragId(null);
    pan.current = null;
    setPanning(false);
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    touched.current = true;
    setView((v) => {
      const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.k * factor));
      const s = k / v.k;
      return { k, tx: px - (px - v.tx) * s, ty: py - (py - v.ty) * s };
    });
  }

  // Non-passive wheel listener so zoom doesn't scroll the page behind it.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetLayout() {
    delete pinsByCase[c.id];
    touched.current = false;
    rerender();
    // fit against the tidy bounds on the next frame
    requestAnimationFrame(() => fit());
  }

  const topLive = Object.values(c.hypotheses)
    .filter((h) => h.status === "live")
    .sort((a, b) => b.probability - a.probability)[0];
  const topLiveId = topLive?.id;
  const selectedPath = new Set<string>();
  let ancestor = selectedId ? c.hypotheses[selectedId] : undefined;
  while (ancestor && !selectedPath.has(ancestor.id)) {
    selectedPath.add(ancestor.id);
    ancestor = ancestor.parentId ? c.hypotheses[ancestor.parentId] : undefined;
  }

  return (
    <>
      <div className="canvas-toolbar">
        <span className="label-caps canvas-hint" title="Hover or focus to trace linked evidence. Click holds the selection; Esc clears highlights. Drag nodes to arrange, drag the canvas to pan, and scroll to zoom.">
          Hover / focus to trace evidence · Esc clears
        </span>
        <div className="canvas-tools">
          <button className="ghost icon-sq" title="Zoom out" onClick={() => zoomAt(centerX(wrapRef), centerY(wrapRef), 1 / 1.2)}>−</button>
          <span className="canvas-zoom data-mono">{Math.round(view.k * 100)}%</span>
          <button className="ghost icon-sq" title="Zoom in" onClick={() => zoomAt(centerX(wrapRef), centerY(wrapRef), 1.2)}>+</button>
          <button className="ghost" onClick={fit}>Fit</button>
          <button className="ghost" onClick={resetLayout}>Reset layout</button>
        </div>
      </div>

      <div
        className={`tree-canvas ${panning ? "panning" : ""}`}
        ref={wrapRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <svg width="100%" height="100%" onPointerDown={onSurfacePointerDown}>
          <defs>
            <pattern
              id="arbor-dots"
              width={20}
              height={20}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${view.tx}, ${view.ty}) scale(${view.k})`}
            >
              <circle cx={1} cy={1} r={1} fill="var(--outline-variant)" />
            </pattern>
          </defs>
          <rect x={0} y={0} width="100%" height="100%" fill="url(#arbor-dots)" />

          <g ref={gRef} transform={`translate(${view.tx}, ${view.ty}) scale(${view.k})`}>
            {/* organic connectors (behind nodes) */}
            {nodes.map((n) => {
              const p = n.parent;
              if (!p) return null;
              const mx = (p.x + NODE_W + n.x) / 2;
              const path = `M ${p.x + NODE_W} ${p.y + NODE_H / 2} C ${mx} ${p.y + NODE_H / 2}, ${mx} ${n.y + NODE_H / 2}, ${n.x} ${n.y + NODE_H / 2}`;
              const dim = n.h.status === "ruled_out";
              const labelX = (p.x + NODE_W + n.x) / 2;
              const labelY = (p.y + n.y) / 2 + NODE_H / 2;
              return (
                <g key={`edge-${n.h.id}`}>
                  <path
                    d={path}
                    className={`organics${selectedPath.has(n.h.id) ? " selected-path" : ""}`}
                    strokeWidth={dim ? 1.5 : 2}
                    strokeDasharray={dim ? "4 4" : undefined}
                    opacity={dim ? 0.45 : 0.7}
                  />
                  {n.edgeLabel && (
                    <foreignObject x={labelX - 70} y={labelY - 12} width={140} height={24} style={{ overflow: "visible" }}>
                      <div className="edge-chip" title={n.edgeLabel}>{truncate(n.edgeLabel, 28)}</div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* nodes — HTML cards via foreignObject so text wraps + card grows */}
            {nodes.map((n) => {
              const col = statusColor(n.h);
              const dim = col.dim;
              const isRoot = n.h.id === ROOT_ID;
              const selected = n.h.id === selectedId;
              const isTop = n.h.id === topLiveId;
              const pct = isRoot ? "" : probabilityLabel(c, n.h);
              const focus = isTop && n.h.status === "live";
              const dragging = dragId === n.h.id;
              const relation = attribution.relation("hypothesis", n.h.id);
              return (
                <g
                  key={n.h.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className={`tree-node ${n.isNew ? "node-enter" : ""} ${dragging ? "node-dragging" : ""}`}
                  role={isRoot ? undefined : "button"}
                  tabIndex={isRoot ? undefined : 0}
                  aria-label={isRoot ? undefined : `${n.h.name}, ${n.h.status}${n.h.isZebra ? ", zebra" : ""}, ${n.h.evidenceFor.length} supporting findings, ${n.h.evidenceAgainst.length} contradicting findings`}
                  aria-pressed={isRoot ? undefined : selected}
                  data-attribution={isRoot ? undefined : relation}
                  data-hypothesis-id={isRoot ? undefined : n.h.id}
                  onPointerEnter={() => { if (!isRoot) attribution.preview({ kind: "hypothesis", id: n.h.id }, "pointer"); }}
                  onPointerLeave={() => attribution.preview(null, "pointer")}
                  onFocus={() => attribution.preview({ kind: "hypothesis", id: n.h.id }, "keyboard")}
                  onBlur={() => attribution.preview(null, "keyboard")}
                  onKeyDown={(event) => {
                    if (isRoot) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault(); event.stopPropagation();
                      attribution.hold({ kind: "hypothesis", id: n.h.id });
                      onSelect(n.h.id);
                    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                      event.preventDefault(); event.stopPropagation();
                      const buttons = [...(gRef.current?.querySelectorAll<SVGGElement>('.tree-node[role="button"]') ?? [])];
                      const index = buttons.indexOf(event.currentTarget);
                      const direction = ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1;
                      buttons[(index + direction + buttons.length) % buttons.length]?.focus();
                    }
                  }}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onClick={(e) => {
                    if (isRoot) return;
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    e.stopPropagation();
                    attribution.hold({ kind: "hypothesis", id: n.h.id });
                    onSelect(n.h.id);
                  }}
                  style={{ cursor: isRoot ? "default" : dragging ? "grabbing" : "grab" }}
                  opacity={dim ? 0.62 : 1}
                >
                  <foreignObject width={NODE_W} height={NODE_H} style={{ overflow: "visible" }}>
                    <div
                      className={`node-card ${focus ? "focus" : ""} ${selected ? "sel" : ""} ${isRoot ? "root" : ""} ${dim ? "dim" : ""}`}
                      style={{
                        borderColor: selected ? "var(--on-surface)" : isTop ? "var(--primary)" : col.stroke,
                        background: focus ? "var(--primary)" : col.fill,
                        color: focus ? "#fff" : col.text,
                      }}
                    >
                      <div className="node-card-head">
                        <span className="node-card-name" title={n.h.name}>{n.h.name}</span>
                        {n.h.isZebra && n.h.status === "live" && <span className="zebra-mark">🦓</span>}
                      </div>
                      {!isRoot && (
                        <div className="node-card-sub">
                          <span className="data-mono">{pct}</span>
                          {n.h.isZebra ? " · zebra" : ""}
                          {n.h.status === "ruled_out" ? " · ruled out" : ""}
                          {n.h.status === "confirmed" ? " · working dx" : ""}
                        </div>
                      )}
                      {isRoot && <div className="node-card-sub">Presentation</div>}
                      {!isRoot && <EvidenceTally h={n.h} />}
                      {!isRoot && relation && relation !== "focused" && <span className="node-attribution-label">{relation === "supports" ? "+ Linked support" : relation === "against" ? "− Linked counterevidence" : relation === "mixed" ? "± Mixed links" : "• Linked observation"}</span>}
                      {n.h.status === "ruled_out" && <div className="node-strike" />}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend — a footer strip that sits directly above the timeline */}
      <div className="legend">
        <span><i style={{ background: "var(--primary-fixed)", border: "1.5px solid var(--primary)" }} /> live</span>
        <span><i style={{ background: "var(--surface-container-low)", border: "1.5px solid var(--branched)" }} /> branched</span>
        <span><i style={{ background: "var(--confirmed-container)", border: "1.5px solid var(--confirmed)" }} /> working dx</span>
        <span><i style={{ background: "var(--surface-container)", border: "1.5px solid var(--outline-variant)" }} /> ruled out (kept for trail)</span>
        <span>🦓 zebra</span>
      </div>
    </>
  );
}

function centerX(ref: React.RefObject<HTMLDivElement>): number {
  const r = ref.current?.getBoundingClientRect();
  return r ? r.left + r.width / 2 : 0;
}
function centerY(ref: React.RefObject<HTMLDivElement>): number {
  const r = ref.current?.getBoundingClientRect();
  return r ? r.top + r.height / 2 : 0;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
