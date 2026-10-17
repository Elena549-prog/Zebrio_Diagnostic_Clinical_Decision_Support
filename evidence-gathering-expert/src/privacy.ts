// GDPR guard: runs before anything leaves the process. See SPEC.md "Data protection".
import type { EvidenceRequest } from "./types.js";

/** The only presentation data Claude ever sees. */
export interface MinimisedPresentation {
  chiefComplaint: string;
  history: string;
  observations: string[];
  sex: string | null;
  ageBand: string | null;
  country: string | null;
}

export type ScreenResult =
  | { ok: true; minimised: MinimisedPresentation }
  | { ok: false; field: string; kind: string };

const ALLOWED_KEYS: Record<string, string[]> = {
  request: ["requestId", "presentation"],
  presentation: ["chiefComplaint", "history", "observations", "demographics"],
  demographics: ["ageYears", "sex", "location", "raceEthnicity", "comorbidities"],
};

const IDENTIFIERS: { kind: string; pattern: RegExp }[] = [
  { kind: "email address", pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { kind: "national ID number", pattern: /\b\d{6}-?\d{4}\b/ },
  { kind: "date", pattern: /\b\d{1,2}[./-]\d{1,2}[./-](\d{4}|\d{2})\b|\b\d{4}-\d{2}-\d{2}\b/ },
  { kind: "record number", pattern: /\b(MRN|CPR|NHS|SSN|patient\s*(id|no|number)|record\s*(no|number))\b/i },
  { kind: "phone number", pattern: /(\+?\d[\d\s()-]{7,}\d)/ },
  { kind: "ID-like number", pattern: /\b\d{6,}\b/ },
  {
    kind: "street address",
    pattern:
      /\b\d{1,4}\s+[A-ZÆØÅÄÖÜ][\wæøåäöüß]*(gade|vej|street|st\.|road|rd\.|avenue|ave|lane|straße|strasse|weg|allee)\b|\b[A-ZÄÖÜ][\wäöüß]*(straße|strasse|weg|gade|vej)\s+\d{1,4}\b/,
  },
];

function findIdentifier(text: string): string | null {
  for (const { kind, pattern } of IDENTIFIERS) {
    const m = text.match(pattern);
    // Phone pattern: require at least 8 digits so vitals like "118/76" never match.
    if (m && (kind !== "phone number" || (m[0].match(/\d/g)?.length ?? 0) >= 8)) return kind;
  }
  return null;
}

function unknownKey(obj: object | undefined, allowed: string[]): string | null {
  if (!obj) return null;
  return Object.keys(obj).find((k) => !allowed.includes(k)) ?? null;
}

export function ageBand(age: number | undefined): string | null {
  if (age == null || !Number.isFinite(age) || age < 0) return null;
  if (age < 5) return "0–4";
  if (age <= 15) return "5–15";
  if (age <= 44) return "16–44";
  if (age <= 64) return "45–64";
  return "65+";
}

function country(location: string | undefined): string | null {
  if (!location?.trim()) return null;
  return location.split(",").pop()!.trim() || null;
}

export function screenRequest(req: EvidenceRequest): ScreenResult {
  const p = req.presentation;
  for (const [obj, path, allowed] of [
    [req, "", ALLOWED_KEYS.request],
    [p, "presentation.", ALLOWED_KEYS.presentation],
    [p?.demographics, "presentation.demographics.", ALLOWED_KEYS.demographics],
  ] as const) {
    const bad = unknownKey(obj as object | undefined, allowed!);
    if (bad) return { ok: false, field: path + bad, kind: "field not allowed" };
  }
  if (!p?.chiefComplaint?.trim()) return { ok: false, field: "presentation.chiefComplaint", kind: "missing" };

  const texts: [string, string][] = [
    ["presentation.chiefComplaint", p.chiefComplaint],
    ["presentation.history", p.history ?? ""],
    ...(p.observations ?? []).map((o, i): [string, string] => [`presentation.observations[${i}]`, o]),
    ["presentation.demographics.location", p.demographics?.location ?? ""],
  ];
  for (const [field, text] of texts) {
    const kind = findIdentifier(text);
    if (kind) return { ok: false, field, kind };
  }

  return {
    ok: true,
    minimised: {
      chiefComplaint: p.chiefComplaint.trim(),
      history: (p.history ?? "").trim(),
      observations: (p.observations ?? []).map((o) => o.trim()).filter(Boolean),
      sex: p.demographics?.sex?.trim() || null,
      ageBand: ageBand(p.demographics?.ageYears),
      country: country(p.demographics?.location),
    },
  };
}
