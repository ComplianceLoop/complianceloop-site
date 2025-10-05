// apps/portal/lib/eligibility.ts
// Pure helpers for provider eligibility: input validation and status ranking.

export type EligibilityInput = {
  zip: string;
  services: string[];
};

export function rankStatus(status: string): number {
  switch (status) {
    case "active":
      return 3;
    case "approved":
      return 2;
    case "pending":
      return 1;
    default:
      return 0;
  }
}

function isPlainString(x: unknown): x is string {
  return typeof x === "string";
}

function isValidZip(zip: string): boolean {
  // US 5-digit ZIP (basic). Extend later for ZIP+4 or other regions.
  return /^[0-9]{5}$/.test(zip);
}

function normalizeServices(svcs: unknown): string[] | null {
  if (!Array.isArray(svcs)) return null;
  const cleaned = svcs
    .filter((s) => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // Enforce uniqueness for deterministic counting
  return Array.from(new Set(cleaned));
}

export function validateEligibilityInput(body: unknown):
  | { ok: true; value: EligibilityInput }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be an object" };
  }
  const { zip, services } = body as Record<string, unknown>;

  if (!isPlainString(zip) || !isValidZip(zip)) {
    return { ok: false, error: "Invalid zip (expected 5-digit string)" };
  }

  const normalized = normalizeServices(services);
  if (!normalized || normalized.length === 0) {
    return { ok: false, error: "Invalid services (non-empty array of strings required)" };
  }
  if (normalized.length > 50) {
    return { ok: false, error: "Too many services (max 50)" };
  }

  return { ok: true, value: { zip, services: normalized } };
}
