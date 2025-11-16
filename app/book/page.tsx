// app/book/page.tsx
export const metadata = {
  title: "Book | ComplianceLoop",
};

export default function BookPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Book an inspection</h1>
        <p className="mt-2 text-slate-600">
          Pick a slot that works. We handle vendor coordination and reminders.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 overflow-hidden">
          {/* Booking embed */}
          <iframe
            title="ComplianceLoop booking"
            src="https://complianceloop-site-hvvxx064s-compliance-loop.vercel.app/book"
            className="w-full"
            style={{ minHeight: "720px" }}
          />
        </div>
      </section>
    </main>
  );
}
