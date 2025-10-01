// apps/portal/app/book/page.tsx
"use client";
import { useMemo, useState } from "react";

type QuoteItem = {
  service_code: "EXIT_SIGN" | "E_LIGHT" | "EXTINGUISHER";
  qty_min: number;
  qty_max: number;
  unit_price_cents: number;
  est_min_cents: number;
  est_max_cents: number;
};

type QuoteResp = {
  ok: boolean;
  estimateSource: "customer_known" | "example_bucket";
  exampleKey: string | null;
  items: QuoteItem[];
  totals: { total_min_cents: number; total_max_cents: number; cap_amount_cents: number };
  examples: { key: string; label: string }[];
};

export default function BookPage() {
  const [mode, setMode] = useState<"customer_known" | "example_bucket">("example_bucket");
  const [exampleKey, setExampleKey] = useState("small_office");

  const [counts, setCounts] = useState({ EXIT_SIGN: 0, E_LIGHT: 0, EXTINGUISHER: 0 });

  const [email, setEmail] = useState("");
  const [site, setSite] = useState("HQ");

  const [quote, setQuote] = useState<QuoteResp | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const itemsForCreate = useMemo(() => {
    if (!quote) return [];
    // If known counts, use exact; else use min as “estimate” placeholder.
    return quote.items.map((i) => ({
      service_code: i.service_code,
      quantity_estimated: mode === "customer_known" ? (counts as any)[i.service_code] ?? 0 : i.qty_min,
      unit_price_cents: i.unit_price_cents,
    }));
  }, [quote, mode, counts]);

  async function getQuote() {
    setErr(null);
    setJobId(null);
    setBusy(true);
    try {
      const body =
        mode === "customer_known"
          ? {
              estimateSource: "customer_known",
              knownCounts: counts,
            }
          : { estimateSource: "example_bucket", exampleKey };

      const res = await fetch("/api/jobs/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Quote error ${res.status}`);
      const json = (await res.json()) as QuoteResp;
      setQuote(json);
    } catch (e: any) {
      setErr(e.message || "Quote failed");
    } finally {
      setBusy(false);
    }
  }

  async function createJob() {
    if (!quote) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: email || "ops+demo@complianceloop.co",
          siteLabel: site || null,
          estimateSource: mode,
          exampleKey: mode === "example_bucket" ? exampleKey : null,
          items: itemsForCreate,
          totals: quote.totals,
        }),
      });
      if (!res.ok) throw new Error(`Create job error ${res.status}`);
      const json = await res.json();
      setJobId(json.jobId);
    } catch (e: any) {
      setErr(e.message || "Create job failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Book Service</h1>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex gap-4">
          <button
            className={`px-3 py-2 rounded-xl border ${mode === "example_bucket" ? "bg-gray-100" : ""}`}
            onClick={() => setMode("example_bucket")}
          >
            I’m not sure (use examples)
          </button>
          <button
            className={`px-3 py-2 rounded-xl border ${mode === "customer_known" ? "bg-gray-100" : ""}`}
            onClick={() => setMode("customer_known")}
          >
            I know the counts
          </button>
        </div>

        {mode === "example_bucket" ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Building type</label>
            <select
              className="w-full rounded-xl border p-2"
              value={exampleKey}
              onChange={(e) => setExampleKey(e.target.value)}
            >
              <option value="small_office">Small Office (≤10k sq ft)</option>
              <option value="mid_office">Mid Office (10k–50k)</option>
              <option value="retail_single">Retail (single unit)</option>
              <option value="warehouse_50k">Warehouse (≤50k sq ft)</option>
              <option value="school_k8">School (K–8, single building)</option>
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"] as const).map((code) => (
              <div key={code} className="space-y-1">
                <label className="block text-sm font-medium">{code.replace("_", " ")}</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border p-2"
                  value={(counts as any)[code]}
                  onChange={(e) => setCounts((s) => ({ ...s, [code]: Number(e.target.value || 0) }))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              className="w-full rounded-xl border p-2"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Site label</label>
            <input
              className="w-full rounded-xl border p-2"
              placeholder="HQ"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            className="px-4 py-2 rounded-xl border"
            onClick={getQuote}
            disabled={busy}
          >
            {busy ? "Working..." : "Get estimate"}
          </button>
          <button
            className="px-4 py-2 rounded-xl border"
            onClick={createJob}
            disabled={!quote || busy}
          >
            {busy ? "Working..." : "Create job"}
          </button>
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        {quote && (
          <div className="rounded-xl border p-3">
            <h2 className="font-medium mb-2">Estimate</h2>
            <ul className="text-sm space-y-1">
              {quote.items.map((i) => (
                <li key={i.service_code}>
                  <span className="font-mono">{i.service_code}</span>:{" "}
                  {i.qty_min === i.qty_max ? i.qty_min : `${i.qty_min}–${i.qty_max}`} units @{" "}
                  {currency(i.unit_price_cents)} → {currency(i.est_min_cents)} – {currency(i.est_max_cents)}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-sm">
              <div>Total: {currency(quote.totals.total_min_cents)} – {currency(quote.totals.total_max_cents)}</div>
              <div className="font-medium">Cap (preauth): {currency(quote.totals.cap_amount_cents)}</div>
            </div>
          </div>
        )}

        {jobId && (
          <div className="rounded-xl border p-3">
            <div className="font-medium">Job created</div>
            <div className="text-sm break-all">Job ID: {jobId}</div>
            <p className="text-sm mt-1">We’ll reconcile to actuals after the visit.</p>
          </div>
        )}
      </div>
    </div>
  );
}
