// Source store: stable ids, one entry per study, quality ranking.
import type { PaperRecord } from "./retrieve/papers.js";
import type { AccessLevel, Source, StoredSource, StudyType } from "./types.js";

const RANK: Record<StudyType, number> = {
  guideline: 0,
  "systematic-review": 1,
  "meta-analysis": 1,
  rct: 2,
  observational: 3,
  other: 4,
};

const ACCESS_RANK: Record<AccessLevel, number> = {
  full_text: 0,
  abstract_only: 1,
  snippet_only: 2,
  paywalled: 3,
  inaccessible: 4,
};

export function classifyStudyType(pubTypes: string[], title: string): StudyType {
  const all = `${pubTypes.join(" | ")} | ${title}`.toLowerCase();
  // "A case report and review of the literature" is a case report, not a review.
  if (isCaseReport(title, pubTypes)) return "other";
  if (/practice guideline|\bguideline/.test(all)) return "guideline";
  if (/meta-analysis|meta analysis/.test(all)) return "meta-analysis";
  if (/systematic review/.test(all)) return "systematic-review";
  if (/randomi[sz]ed controlled trial/.test(all)) return "rct";
  if (/cohort|cross-sectional|case-control|observational|prospective|retrospective|diagnostic accuracy|validation/.test(all)) {
    return "observational";
  }
  return "other";
}

const CASE_REPORT = /\bcase reports?\b|\bcase series\b|^an? (rare |unusual )?case of\b/i;

/** Case reports describe single patients; they cannot give a base rate or a likelihood ratio. */
export function isCaseReport(title: string, pubTypes: string[] = []): boolean {
  return pubTypes.some((t) => /case report/i.test(t)) || CASE_REPORT.test(title);
}

/** Guideline > review/meta-analysis > RCT > observational > other > case report; newer first. */
export function rankSources<T extends Pick<Source, "studyType" | "year" | "accessLevel" | "title">>(sources: T[]): T[] {
  return [...sources].sort(
    (a, b) =>
      Number(isCaseReport(a.title)) - Number(isCaseReport(b.title)) ||
      RANK[a.studyType] - RANK[b.studyType] ||
      (b.year ?? 0) - (a.year ?? 0) ||
      ACCESS_RANK[a.accessLevel] - ACCESS_RANK[b.accessLevel],
  );
}

export function paperUrl(r: Pick<PaperRecord, "pmcid" | "pmid" | "doi">): string {
  if (r.pmcid) return `https://europepmc.org/article/PMC/${r.pmcid}`;
  if (r.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`;
  return `https://doi.org/${r.doi}`;
}

export function paperSource(r: PaperRecord, accessLevel: AccessLevel, text: string, retrievedAt: string): StoredSource {
  const id = r.pmcid ? `pmcid:${r.pmcid}` : r.pmid ? `pmid:${r.pmid}` : `doi:${r.doi!.toLowerCase()}`;
  return {
    id,
    url: paperUrl(r),
    doiUrl: r.doi ? `https://doi.org/${r.doi}` : undefined,
    title: r.title,
    pmid: r.pmid,
    pmcid: r.pmcid,
    doi: r.doi,
    studyType: classifyStudyType(r.pubTypes, r.title),
    year: r.year,
    accessLevel,
    retrievedAt,
    provider: r.provider,
    text,
  };
}

/**
 * All sources seen during one request. A study found twice (by PMID and by PMCID, or by
 * two questions) is stored once, so it can never count as independent corroboration.
 */
export class SourceStore {
  private byId = new Map<string, StoredSource>();
  private alias = new Map<string, string>();

  private keys(s: Pick<StoredSource, "id" | "pmid" | "pmcid" | "doi" | "url">): string[] {
    return [
      s.id,
      s.pmcid && `pmcid:${s.pmcid.toUpperCase()}`,
      s.pmid && `pmid:${s.pmid}`,
      s.doi && `doi:${s.doi.toLowerCase()}`,
      `url:${s.url.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase()}`,
    ].filter((k): k is string => Boolean(k));
  }

  find(s: Pick<StoredSource, "id" | "pmid" | "pmcid" | "doi" | "url">): StoredSource | undefined {
    for (const k of this.keys(s)) {
      const id = this.alias.get(k);
      if (id) return this.byId.get(id);
    }
    return undefined;
  }

  /** Add or merge; returns the canonical entry. Keeps the first id, upgrades text if better access. */
  add(s: StoredSource): StoredSource {
    const existing = this.find(s);
    if (existing) {
      if (ACCESS_RANK[s.accessLevel] < ACCESS_RANK[existing.accessLevel]) {
        Object.assign(existing, { accessLevel: s.accessLevel, text: s.text, retrievedAt: s.retrievedAt });
      }
      existing.pmid ??= s.pmid;
      existing.pmcid ??= s.pmcid;
      existing.doi ??= s.doi;
      existing.doiUrl ??= s.doiUrl;
      for (const k of this.keys(existing)) this.alias.set(k, existing.id);
      return existing;
    }
    this.byId.set(s.id, s);
    for (const k of this.keys(s)) this.alias.set(k, s.id);
    return s;
  }

  get(id: string): StoredSource | undefined {
    return this.byId.get(this.alias.get(id) ?? id);
  }

  all(): StoredSource[] {
    return [...this.byId.values()];
  }
}

export function publicSource({ text: _text, ...s }: StoredSource): Source {
  return s;
}
