// apps/portal/lib/quote-examples.ts
// Example-based ranges shown when customer "doesn't know" counts.
// Keep in sync with decisions.json bookingEstimationPolicy examples.

export type ExampleKey =
  | "small_office"
  | "mid_office"
  | "retail_single"
  | "warehouse_50k"
  | "school_k8";

export type ServiceCode = "EXIT_SIGN" | "E_LIGHT" | "EXTINGUISHER";

export type ExampleBucket = {
  key: ExampleKey;
  label: string;
  ranges: {
    EXIT_SIGN: [number, number];
    E_LIGHT: [number, number];
    EXTINGUISHER: [number, number];
  };
};

export const EXAMPLES: ExampleBucket[] = [
  {
    key: "small_office",
    label: "Small Office (≤10k sq ft)",
    ranges: { EXIT_SIGN: [8, 15], E_LIGHT: [10, 20], EXTINGUISHER: [6, 12] }
  },
  {
    key: "mid_office",
    label: "Mid Office (10k–50k)",
    ranges: { EXIT_SIGN: [20, 40], E_LIGHT: [25, 50], EXTINGUISHER: [12, 24] }
  },
  {
    key: "retail_single",
    label: "Retail (single unit)",
    ranges: { EXIT_SIGN: [4, 8], E_LIGHT: [6, 12], EXTINGUISHER: [2, 6] }
  },
  {
    key: "warehouse_50k",
    label: "Warehouse (≤50k sq ft)",
    ranges: { EXIT_SIGN: [6, 12], E_LIGHT: [8, 16], EXTINGUISHER: [6, 12] }
  },
  {
    key: "school_k8",
    label: "School (K–8, single building)",
    ranges: { EXIT_SIGN: [15, 30], E_LIGHT: [20, 40], EXTINGUISHER: [15, 30] }
  }
];

export type UnitPriceMap = Record<ServiceCode, number>;

// default unit prices; adjust later or fetch from DB/config
export const DEFAULT_UNIT_PRICES: UnitPriceMap = {
  EXIT_SIGN: 29,      // per unit service
  E_LIGHT: 29,
  EXTINGUISHER: 19
};

export function findExample(key: ExampleKey | string | null | undefined) {
  if (!key) return null;
  return EXAMPLES.find((e) => e.key === key) || null;
}
