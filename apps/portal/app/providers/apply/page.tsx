// apps/portal/app/providers/apply/page.tsx
"use client";
import { useState } from "react";

const ALL_SERVICES = [
  { code: "EXIT_SIGN", label: "Exit signs" },
  { code: "E_LIGHT", label: "Emergency lights" },
  { code: "EXTINGUISHER", label: "Fire extinguishers" }
];

export default function ProviderApplyPage() {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [postalCodes, setPostalCodes] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggleService = (code: string) => {
    setServices((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));
  };

  async function submit() {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const body = {
        companyName,
        contactEmail: email,
        contactPhone: phone || undefined,
        services,
        postalCodes: postalCodes.split(/[\s,]+/).filter(Boolean).slice(0, 50),
        country: "US"
      };
      const r = await fetch("/api/providers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(j));
      setRes(j);
    } catch (e: any) {
      setErr(e.message || "submit_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Provider Application</h1>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Company</label>
            <input className="w-full rounded-xl border p-2" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Contact email</label>
            <input className="w-full rounded-xl border p-2" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Phone (optional)</label>
            <input className="w-full rounded-xl border p-2" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Postal codes (comma or space separated)</label>
            <input className="w-full rounded-xl border p-2" placeholder="06010 06011 06012" value={postalCodes} onChange={e => setPostalCodes(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Services</div>
          <div className="flex flex-wrap gap-3">
            {ALL_SERVICES.map(s => (
              <label key={s.code} className="flex items-center gap-2">
                <input type="checkbox" checked={services.includes(s.code)} onChange={() => toggleService(s.code)} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-xl border" onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit application"}
          </button>
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}
        {res && (
          <div className="rounded-xl border p-3">
            <div className="font-medium">Application received</div>
            <div className="text-sm break-all">Provider ID: {res.providerId}</div>
            <p className="text-sm mt-1">We will email you once approved.</p>
          </div>
        )}
      </div>
    </div>
  );
}
