/**
 * In-memory case store. A real deployment would persist this; for the
 * runnable demo an in-memory map keyed by case id is enough and keeps the
 * trace fully server-side.
 */

import type { Case, CaseEvent, CaseSnapshot } from "./types.js";

class CaseStore {
  private cases = new Map<string, Case>();
  private nextSeq = 1;

  create(c: Case): Case {
    this.cases.set(c.id, c);
    return c;
  }

  get(id: string): Case | undefined {
    return this.cases.get(id);
  }

  /** Mutate a case under a lock-free update; returns the new snapshot. */
  update(id: string, fn: (c: Case) => void): CaseSnapshot | undefined {
    const c = this.cases.get(id);
    if (!c) return undefined;
    fn(c);
    c.updatedAt = new Date().toISOString();
    return c;
  }

  list(): CaseSnapshot[] {
    return [...this.cases.values()]
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .map((c) => this.publicSnapshot(c));
  }

  delete(id: string): boolean {
    return this.cases.delete(id);
  }

  snapshot(id: string): CaseSnapshot | undefined {
    const c = this.cases.get(id);
    return c ? this.publicSnapshot(c) : undefined;
  }

  /** Strip anything that shouldn't leave the server (currently nothing). */
  private publicSnapshot(c: Case): CaseSnapshot {
    return c;
  }

  seq(): number {
    return this.nextSeq++;
  }
}

export const store = new CaseStore();

/** Append an event to a case, bumping the round when relevant. */
export function appendEvent(c: Case, ev: Omit<CaseEvent, "id" | "createdAt">): CaseEvent {
  const full: CaseEvent = {
    ...ev,
    id: `evt_${c.id}_${store.seq()}`,
    createdAt: new Date().toISOString(),
  };
  c.events.push(full);
  return full;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
