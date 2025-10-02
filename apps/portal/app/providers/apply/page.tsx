'use client';

import { useState } from 'react';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'success'; providerId: string };

export default function ProviderApplyPage() {
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [postal, setPostal] = useState('');
  const [svcExit, setSvcExit] = useState(true);
  const [svcLight, setSvcLight] = useState(true);
  const [svcExt, setSvcExt] = useState(false);
  const [state, setState] = useState<SubmitState>({ status: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'submitting' });

    const postalCodes = postal
      .split(/[,\s]+/g)
      .map((z) => z.trim())
      .filter(Boolean);

    const services = [
      svcExit ? 'EXIT_SIGN' : null,
      svcLight ? 'E_LIGHT' : null,
      svcExt ? 'EXTINGUISHER' : null,
    ].filter(Boolean) as string[];

    const payload = {
      companyName: company.trim(),
      contactEmail: email.trim(),
      contactPhone: phone.trim() || undefined,
      services,
      postalCodes,
      country: 'US',
    };

    try {
      const res = await fetch('/api/providers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text(); // robust: handle empty body
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // keep raw text for error visibility
      }

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          text ||
          `${res.status} ${res.statusText}`;
        setState({ status: 'error', message: String(msg) });
        return;
      }

      const providerId = data?.providerId || '(missing id)';
      setState({ status: 'success', providerId });
    } catch (err: any) {
      setState({
        status: 'error',
        message: err?.message || 'Network error',
      });
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Provider Application</h1>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm">Company</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="rounded-md px-3 py-2 bg-neutral-900 border border-neutral-700"
              placeholder="Acme Fire"
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm">Contact email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="rounded-md px-3 py-2 bg-neutral-900 border border-neutral-700"
              placeholder="ops+acme@complianceloop.co"
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm">Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-md px-3 py-2 bg-neutral-900 border border-neutral-700"
              placeholder="555-0100"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm">Postal codes (comma or space separated)</span>
            <input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              className="rounded-md px-3 py-2 bg-neutral-900 border border-neutral-700"
              placeholder="06010 06011 06012"
              required
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm">Services</legend>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={svcExit} onChange={(e) => setSvcExit(e.target.checked)} />
              <span>Exit signs</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={svcLight} onChange={(e) => setSvcLight(e.target.checked)} />
              <span>Emergency lights</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={svcExt} onChange={(e) => setSvcExt(e.target.checked)} />
              <span>Fire extinguishers</span>
            </label>
          </div>
        </fieldset>

        <button
          disabled={state.status === 'submitting'}
          className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20 disabled:opacity-50"
          type="submit"
        >
          {state.status === 'submitting' ? 'Submitting…' : 'Submit application'}
        </button>

        {state.status === 'error' && (
          <p className="text-red-400 text-sm">
            {state.message}
          </p>
        )}

        {state.status === 'success' && (
          <div className="rounded-md border border-green-700 p-3 text-sm">
            ✅ Submitted! Provider ID: <code className="font-mono">{state.providerId}</code>
          </div>
        )}
      </form>
    </div>
  );
}
