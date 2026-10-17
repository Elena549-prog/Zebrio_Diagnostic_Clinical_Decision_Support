import { describe, expect, it } from "vitest";
import { screenRequest } from "../src/privacy.js";
import type { EvidenceRequest } from "../src/types.js";

const base: EvidenceRequest = {
  presentation: {
    chiefComplaint: "Sore throat and fever for 2 days",
    history: "Pain on swallowing, fever 38.6°C, no cough, no runny nose.",
    observations: ["T 38.6°C, HR 88, BP 118/76", "Exudate on tonsils"],
    demographics: { ageYears: 9, sex: "female", location: "Aarhus, Denmark" },
  },
};

function withHistory(history: string): EvidenceRequest {
  return { presentation: { ...base.presentation, history } };
}

describe("screenRequest", () => {
  it("accepts a pseudonymised presentation and minimises demographics", () => {
    const r = screenRequest(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.minimised.ageBand).toBe("5–15");
    expect(r.minimised.country).toBe("Denmark");
    expect(r.minimised.sex).toBe("female");
    expect(JSON.stringify(r.minimised)).not.toContain("Aarhus");
    expect(JSON.stringify(r.minimised)).not.toMatch(/"ageYears"/);
  });

  it.each([
    ["an email address", "Contact mother at anna.jensen@mail.dk for results."],
    ["a phone number", "Call +45 20 12 34 56 if worse."],
    ["a date of birth", "Born 12.03.2017, fever since Monday."],
    ["an ISO date", "Seen on 2026-10-15 in clinic."],
    ["a Danish CPR number", "CPR 120317-1234."],
    ["a record number", "MRN 88213347, fever."],
    ["a street address", "Lives at 14 Vestergade, Aarhus."],
  ])("rejects free text containing %s and names the field", (_label, history) => {
    const r = screenRequest(withHistory(history));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("presentation.history");
  });

  it("rejects identifier fields that are not part of the schema", () => {
    const r = screenRequest({
      presentation: { ...base.presentation, patientName: "Anna Jensen" } as never,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("presentation.patientName");
  });

  it("does not mistake vital signs for identifiers", () => {
    const r = screenRequest(withHistory("BP 118/76, HR 88, T 38.6°C, SpO2 98%, 3 days of fever."));
    expect(r.ok).toBe(true);
  });
});
