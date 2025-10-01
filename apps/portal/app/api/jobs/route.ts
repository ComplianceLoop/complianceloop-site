// apps/portal/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureJobTables } from "../../../db/bootstrap.sql";
import { getSql } from "../../../lib/neon";

type StripeIntentResult =
  | { mode: "mock"; id: string; client_secret: string | null; status: "mock" }
  | { mode: "payment_intent"; id: string; client_secret: string | null; status: string };

export const dynamic = "force-dynamic";

const JobCreateSchema = z.object({
  customerEmail: z.string().email(),
  siteLabel: z.string().optional(),
  estimateSource: z.enum(["customer_known", "example_bucket"]),
  exampleKey: z.string().nullable().optional(),
  items: z.array(
    z.object({
      service_code: z.enum(["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"]),
      quantity_estimated: z.number().int().min(0).nullable().optional(),
      unit_price_cents: z.number().int().min(0)
    })
  ),
  totals: z.object({
    total_min_cents: z.number().int().min(0),
    total_max_cents: z.number().int().min(0),
    cap_amount_cents: z.number().int().min(0)
  })
});

async function createPreauth(capAmountCents: number): Promise<StripeIntentResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return { mode: "mock", id: "pi_mock_" + Math.random().toString(36).slice(2), client_secret: null, status: "mock" };
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key); // use SDK default apiVersion

  const pi = await stripe.paymentIntents.create({
    amount: capAmountCents,
    currency: "usd",
    capture_method: "manual",
    automatic_payment_methods: { enabled: true }
  });

  return { mode: "payment_intent", id: pi.id, client_secret: pi.client_secret, status: pi.status };
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => ({}));
  const parsed = JobCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const sql = getSql();
  await ensureJobTables();

  const preauth = await createPreauth(parsed.data.totals.cap_amount_cents);

  // Remove the Neon generic and cast after await to avoid TS “got N args” error
  const rows = (await sql`
    insert into jobs (
      customer_email, site_label,
      estimate_total_min_cents, estimate_total_max_cents, cap_amount_cents,
      estimate_source, example_key, preauth_id, preauth_status, status
    ) values (
      ${parsed.data.customerEmail},
      ${parsed.data.siteLabel || null},
      ${parsed.data.totals.total_min_cents},
      ${parsed.data.totals.total_max_cents},
      ${parsed.data.totals.cap_amount_cents},
      ${parsed.data.estimateSource},
      ${parsed.data.exampleKey || null},
      ${preauth.id},
      ${preauth.status},
      'scheduled'
    )
    returning id;
  `) as Array<{ id: string }>;

  const jobId = rows[0]?.id;

  for (const item of parsed.data.items) {
    await sql`
      insert into job_items (job_id, service_code, quantity_estimated, unit_price_cents, tier_snapshot)
      values (${jobId}, ${item.service_code}, ${item.quantity_estimated ?? null}, ${item.unit_price_cents}, ${null});
    `;
  }

  return NextResponse.json({ ok: true, jobId, preauth }, { status: 200 });
}
