/**
 * Timeline — the bottom strip, and the case's time machine.
 *
 * It used to be a read-only row of dots. It is now a scrubber: drag the handle,
 * step with the arrows, or press play and watch the reasoning replay itself.
 * Whatever frame is selected drives the whole workspace — tree, ranked list,
 * evidence, detail — so you see the case as it actually stood at that step, not
 * a summary of it.
 *
 * Two things make it work at scale. Frames come from the server's history tape
 * (server/domain/history.ts), so a 67-round case is 67 real states rather than
 * a reconstruction. And the track's tick density adapts: below ~14 frames every
 * node is captioned, above that captions collapse to the current and hovered
 * frames so the strip stays legible however long the case runs.
 *
 * It never mutates the case. Scrubbing away from the present puts the workspace
 * in a read-only review mode; "Return to now" comes back.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Case, HistoryEntry } from "./types.js";
import { describeDiff, diffFrames } from "./timeTravel.js";

interface Props {
  c: Case;
  /** Selected frame index, or null when watching the present. */
  frameIdx: number | null;
  onScrub: (idx: number | null) => void;
  /**
   * Step mode: every position is "the present", so there is no review banner
   * and no "Return to now". The tutorial uses this — there, scrubbing the
   * timeline simply *is* stepping the tour, and the tape is the whole tour.
   */
  stepMode?: boolean;
}

/** How long each frame holds during playback. */
const PLAY_MS = 1100;
/** Above this many frames, captions collapse to current + hovered. */
const DENSE_ABOVE = 14;

export function Timeline({ c, frameIdx, onScrub, stepMode = false }: Props) {
  const frames = c.history ?? [];
  const last = frames.length - 1;
  const idx = frameIdx ?? last;
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const live = stepMode || frameIdx === null;
  const dense = frames.length > DENSE_ABOVE;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(last, next));
      // Landing on the newest frame means we're watching the present again,
      // so the workspace leaves review mode rather than pinning to a stale copy.
      onScrub(!stepMode && clamped === last ? null : clamped);
    },
    [last, onScrub, stepMode],
  );

  // Playback. Stops itself at the end rather than looping — the end of the
  // tape is the present, which is where you want to be left.
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => goTo(idx + 1), PLAY_MS);
    return () => clearTimeout(t);
  }, [playing, idx, last, goTo]);

  // Arrow keys scrub, space toggles playback — but never while the clinician
  // is typing into a field somewhere else on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (e.key === "ArrowLeft") { setPlaying(false); goTo(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setPlaying(false); goTo(idx + 1); e.preventDefault(); }
      else if (e.key === " " && frames.length > 1) { setPlaying((p) => !p); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, goTo, frames.length]);

  /** Map a pointer x to the nearest frame. */
  const frameAtX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || last <= 0) return 0;
      const r = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return Math.round(pct * last);
    },
    [last],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      goTo(frameAtX(e.clientX));
    };
    const up = () => { draggingRef.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [frameAtX, goTo]);

  if (frames.length === 0) {
    return (
      <div className="timeline">
        <span className="timeline-label">Timeline</span>
        <div className="timeline-track"><div className="timeline-line" /></div>
      </div>
    );
  }

  const cur = frames[idx]!;
  const diff = diffFrames(frames[idx - 1], cur);
  const pct = last <= 0 ? 100 : (idx / last) * 100;
  const shown = hover !== null ? frames[hover] : null;

  return (
    <div className={`timeline ${live ? "" : "reviewing"}`}>
      <div className="timeline-controls">
        <button
          className="tl-btn ghost"
          onClick={() => { setPlaying(false); goTo(idx - 1); }}
          disabled={idx <= 0}
          title="Previous step (←)"
          aria-label="Previous step"
        >
          ◀
        </button>
        <button
          className="tl-btn play"
          onClick={() => {
            // Playing from the end replays the case from the beginning, which
            // is what "watch how we got here" means when you're already at now.
            if (idx >= last) goTo(0);
            setPlaying((p) => !p);
          }}
          disabled={frames.length < 2}
          title={playing ? "Pause (space)" : "Replay the reasoning (space)"}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          className="tl-btn ghost"
          onClick={() => { setPlaying(false); goTo(idx + 1); }}
          disabled={idx >= last}
          title="Next step (→)"
          aria-label="Next step"
        >
          ▶
        </button>
      </div>

      <div
        className="timeline-track"
        ref={trackRef}
        onPointerDown={(e) => {
          draggingRef.current = true;
          setPlaying(false);
          goTo(frameAtX(e.clientX));
        }}
        role="slider"
        tabIndex={0}
        aria-label="Case timeline"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={idx}
        aria-valuetext={cur.label}
      >
        <div className="timeline-line" />
        {/* Travelled portion, so progress reads at a glance. */}
        <div className="timeline-line filled" style={{ width: `${pct}%` }} />
        {frames.map((f, i) => {
          const left = last <= 0 ? 0 : (i / last) * 100;
          const isCur = i === idx;
          const showCaption = !dense || isCur || i === hover || i === 0 || i === last;
          return (
            <div
              key={f.seq}
              className={`timeline-node ${isCur ? "current" : ""} ${i < idx ? "past" : ""} ${critical(f) ? "critical" : ""}`}
              style={{ left: `${left}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              title={`${f.label} — ${describeDiff(diffFrames(frames[i - 1], f))}`}
            >
              <div className="timeline-dot" />
              {showCaption && <span className="timeline-caption">{f.label}</span>}
            </div>
          );
        })}
        {/* The handle sits above the dots so the grab target is obvious. */}
        <div className="timeline-handle" style={{ left: `${pct}%` }} />
      </div>

      <div className="timeline-readout">
        <div className="tl-step">
          {(shown ?? cur).label}
          <span className="muted"> · step {(hover ?? idx) + 1} of {frames.length}</span>
        </div>
        <div className="tl-change muted small">
          {describeDiff(shown ? diffFrames(frames[hover! - 1], shown) : diff)}
        </div>
      </div>

      {!live && (
        <button className="tl-now" onClick={() => { setPlaying(false); onScrub(null); }}>
          Return to now
        </button>
      )}
    </div>
  );
}

/** A frame the clinician acted on — a result entered, or the case concluded. */
function critical(f: HistoryEntry): boolean {
  return f.kind === "finding" || f.kind === "diagnosis" || f.kind === "treatment";
}
