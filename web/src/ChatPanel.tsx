/**
 * ChatPanel — free-text decision-support Q&A with the engine.
 *
 * The round / diagnose / treat buttons used to live here; they have moved to
 * the NextAction rail, where they sit in the linear path the clinician walks.
 * This panel is now the "ask the engine" channel: "why this hypothesis?",
 * "what test splits the top 2?", "show me the zebra".
 *
 * It reads as ONE conversation anchored to the input at the bottom. Round
 * narration (engine_message / diagnosis / treatment events) and the
 * clinician's own questions are merged into a single time-ordered thread
 * instead of being split into two labelled sections — previously the answer to
 * a question landed in a separate block above the narration, so it was never
 * obvious where the reply to what you just asked had gone. Now the newest turn
 * is always the last thing above the box you typed in, and the thread
 * auto-scrolls to it.
 */

import { useEffect, useRef, useState } from "react";
import type { Case, CaseEvent } from "./types.js";
import * as api from "./api.js";

interface Props {
  c: Case;
  onUpdated: (c: Case) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}

/** One turn in the thread. A question and its answer are separate turns so
 *  they stack in reading order directly above the input. */
type Turn =
  | { kind: "narration"; id: string; at: string; role: string; body: string; eventKind: string }
  | { kind: "you"; id: string; at: string; body: string }
  | { kind: "answer"; id: string; at: string; body: string };

interface QA {
  q: string;
  a: string | null;
  at: string;
  id: string;
}

export function ChatPanel({ c, onUpdated: _onUpdated, busy, setBusy }: Props) {
  const [msg, setMsg] = useState("");
  const [qa, setQa] = useState<QA[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const events = c.events.filter(
    (e) => e.kind === "engine_message" || e.kind === "diagnosis" || e.kind === "treatment",
  );

  // Merge narration and Q&A into one chronological thread.
  const turns: Turn[] = [
    ...events.map((e: CaseEvent) => ({
      kind: "narration" as const,
      id: e.id,
      at: e.createdAt,
      role: labelFor(e.kind),
      body: e.summary,
      eventKind: e.kind,
    })),
    ...qa.flatMap((p): Turn[] => [
      { kind: "you", id: `${p.id}-q`, at: p.at, body: p.q },
      ...(p.a !== null ? [{ kind: "answer" as const, id: `${p.id}-a`, at: p.at, body: p.a }] : []),
    ]),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  // Anchor on the newest turn: the answer to what you just asked is always the
  // last thing above the input.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, busy]);

  async function send() {
    const q = msg.trim();
    if (!q || busy) return;
    const id = `qa-${Date.now()}`;
    const at = new Date().toISOString();
    setMsg("");
    setBusy(true);
    // Echo the question into the thread immediately, so it is visible in place
    // while the engine is still thinking.
    setQa((prev) => [...prev, { q, a: null, at, id }]);
    try {
      const r = await api.chat(c.id, q);
      setQa((prev) => prev.map((p) => (p.id === id ? { ...p, a: r.reply } : p)));
    } catch (e) {
      setQa((prev) => prev.map((p) => (p.id === id ? { ...p, a: `⚠️ ${(e as Error).message}` } : p)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-thread">
        {turns.length === 0 && (
          <p className="muted small chat-empty">
            Ask the engine a question — your question and its answer appear here, newest at the
            bottom.
          </p>
        )}
        {turns.map((t) =>
          t.kind === "you" ? (
            <div key={t.id} className="msg you">
              <div className="msg-role">you</div>
              <div className="msg-body">{t.body}</div>
            </div>
          ) : t.kind === "answer" ? (
            <div key={t.id} className="msg engine_message answer">
              <div className="msg-role">engine</div>
              <div className="msg-body">{t.body}</div>
            </div>
          ) : (
            <div key={t.id} className={`msg ${t.eventKind} narration`}>
              <div className="msg-role">{t.role}</div>
              <div className="msg-body">{t.body}</div>
            </div>
          ),
        )}
        {busy && (
          <div className="msg engine_message answer pending">
            <div className="msg-role">engine</div>
            <div className="msg-body">
              <span className="spinner" /> thinking…
            </div>
          </div>
        )}
        <div ref={endRef} className="chat-end" />
      </div>

      <div className="chat-input">
        <textarea
          placeholder="Ask: “why this hypothesis?”, “what test splits the top 2?”, “show me the zebra”…"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send} disabled={busy || !msg.trim()}>
          {busy ? <span className="spinner" /> : null} Send
        </button>
      </div>
    </div>
  );
}

function labelFor(kind: string): string {
  switch (kind) {
    case "engine_message":
      return "engine";
    case "diagnosis":
      return "diagnosis";
    case "treatment":
      return "treatment plan";
    default:
      return kind;
  }
}
