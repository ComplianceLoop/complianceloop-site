// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold">ComplianceLoop</div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/#services" className="hover:opacity-80">Services</Link>
            <Link href="/#pricing" className="hover:opacity-80">Pricing</Link>
            <Link href="/book" className="rounded-full bg-slate-900 text-white px-4 py-2 hover:opacity-90">
              Contact / Book
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Property compliance, <span className="text-sky-500">coordinated.</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            One coordinator, one schedule, one invoice, zero missed deadlines.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/book" className="rounded-lg bg-slate-900 text-white px-5 py-3 hover:opacity-90">
              Book a time
            </Link>
            <Link href="/#services" className="rounded-lg border border-slate-300 px-5 py-3 hover:bg-slate-50">
              See services
            </Link>
          </div>

          <ul className="mt-8 space-y-2 text-sm text-slate-600">
            <li>• Fire extinguisher inspections (NFPA 10)</li>
            <li>• Emergency lighting & exit sign testing</li>
            <li>• Backflow testing (public water)</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 shadow-sm p-4">
          {/* Placeholder for a booking card preview */}
          <div className="aspect-[4/3] w-full rounded-xl border border-slate-200 grid place-items-center">
            <span className="text-slate-400 text-sm">Booking widget goes here</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Replace with your Cal/booking embed or keep as-is and direct users to <code>/book</code>.
          </p>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-6 py-16 border-t border-slate-100">
        <h2 className="text-2xl font-semibold">Services</h2>
        <p className="mt-3 text-slate-600">Inspection scheduling, vendor coordination, reminders, and documentation.</p>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16 border-t border-slate-100">
        <h2 className="text-2xl font-semibold">Pricing</h2>
        <p className="mt-3 text-slate-600">Flat-fee packages. Custom quotes for multi-site portfolios.</p>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 border-t border-slate-100 text-sm text-slate-500">
        © {new Date().getFullYear()} ComplianceLoop
      </footer>
    </main>
  );
}
