// Human-readable summary with clickable citation links (terminals turn https URLs into links).
import type { EvidenceResponse } from "./types.js";

const fmt = (n: number | null | undefined) => (n == null ? null : String(n));

export function formatCitations(res: EvidenceResponse): string {
  const lines: string[] = [`Evidence for request ${res.requestId}: ${res.status}`];
  const cite = (ids: string[]) =>
    ids.map((id) => {
      const e = res.evidence.find((x) => x.id === id)!;
      return `      [${id}] ${e.url}\n            "${e.passage}"`;
    });

  for (const d of res.diagnoses) {
    lines.push("", `${d.diagnosis} (suggested by model, not a diagnosis)`);
    const p = d.prior;
    const value = fmt(p.value);
    lines.push(`  Base rate: ${p.status}${value ? ` = ${value}${p.ci95 ? ` (95% CI ${p.ci95.join("–")})` : ""}` : ""}`);
    lines.push(...cite(p.evidenceIds));
    for (const l of d.likelihoodRatios) {
      const nums = [
        l.lrPositive != null && `LR+ ${l.lrPositive}`,
        l.lrNegative != null && `LR- ${l.lrNegative}`,
        l.sensitivity != null && `sens ${l.sensitivity}`,
        l.specificity != null && `spec ${l.specificity}`,
      ].filter(Boolean);
      lines.push(`  ${l.finding} (patient: "${l.quotedFrom}"): ${l.status}${nums.length ? ` = ${nums.join(", ")}` : ""}`);
      lines.push(...cite(l.evidenceIds));
    }
  }
  if (res.sources.length) {
    lines.push("", "Sources:");
    for (const s of res.sources) lines.push(`  ${s.id}  ${s.accessLevel}  ${s.studyType}  ${s.url}`);
  }
  if (res.errors.length) {
    lines.push("", "Problems:");
    for (const e of res.errors) lines.push(`  [${e.step}] ${e.message}`);
  }
  return lines.join("\n");
}
