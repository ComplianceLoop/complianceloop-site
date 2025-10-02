// apps/portal/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "../../../lib/neon";
import bootstrap from "../../../db/bootstrap.sql"; // default export: SQL string

export const dynamic = "force-dynamic";

// Request payload from /book UI
const ReqSchema = z.object({
  customerEmail: z.string().email(),
  siteLabel: z.string().optional().default(""),
  estimateSource: z.string(), // "examples" | "known_counts" | etc.
  exampleKey: z.string().optional().nullable(),
  totals: z.object({
    total_min_cents: z.number().int().nonnegative(),
    total_max_cents: z.number().int().nonnegative(),
    cap_amount_cents: z.number().int().positive()
  }),
  // Optional items for persistence (service_code, qty, unit price cents)
  items: z
    .array(
      z.object({
        service_code: z.string(),
        quantity_estimated: z.number().int().nonnegative().default(0),
        unit_price_cents: z.number().int().nonnegative().default(0)
      })
    )
    .optional()
});

type StripeIntentResult =
  | { mode: "payment_intent"; id: string; client_secret: string | null; status: string }
  | { mode: "mock"; id: string; client_secret: null; status: "mock" };

async function createPreauth(capAmountCents: number): Promise<StripeIntentResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Fallback mock for environments without Stripe configured
    return {
      mode: "mock",
      id: `pi_mock_${Math.random().toString(36).slice(2)}`,
      client_secret: null,
      status: "mock"
    };
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key, { apiVersion: "2022-11-15" as any });

  const intent = await stripe.paymentIntents.create({
    amount: capAmountCents,
    currency: "usd",
    capture_method: "manual",
    automatic_payment_methods: { enabled: true },
    description: "ComplianceLoop job cap preauth"
  });

  return {
    mode: "payment_intent",
    id: intent.id,
    client_secret: intent.client_secret ?? null,
    status: intent.status
  };
}

export async function POST(req: Request) {
  const sql = getSql();

  // Ensure DDL exists (idempotent)
  await sql`${bootstrap}`;

  let parsed: z.infer<typeof ReqSchema>;
  try {
    const body = await req.json();
    parsed = ReqSchema.parse(body);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "invalid_request", detail: String(err?.message || err) }, { status: 400 });
  }

  // Create or mock preauth
  const preauth = await createPreauth(parsed.totals.cap_amount_cents);

  // Insert job
  const [row] = await sql<{ id: string }>`
    INSERT INTO jobs (
      customer_email,
      site_label,
      estimate_source,
      example_key,
      total_min_cents,
      total_max_cents,
      cap_amount_cents,
      preauth_mode,
      preauth_id
    ) VALUES (
      ${parsed.customerEmail},
      ${parsed.siteLabel || ""},
      ${parsed.estimateSource},
      ${parsed.exampleKey || null},
      ${parsed.totals.total_min_cents},
      ${parsed.totals.total_max_cents},
      ${parsed.totals.cap_amount_cents},
      ${preauth.mode},
      ${preauth.id}
    )
    RETURNING id;
  `;

  // Optional: persist item rows
  if (parsed.items && parsed.items.length) {
    const values = parsed.items.map((it) =>
      sql`(${row.id}, ${it.service_code}, ${it.quantity_estimated}, ${it.unit_price_cents})`
    );
    await sql`
      INSERT INTO job_items (job_id, service_code, quantity_estimated, unit_price_cents)
      VALUES ${sql.join(values, sql`,`) }
      ON CONFLICT (job_id, service_code) DO UPDATE
        SET quantity_estimated = EXCLUDED.quantity_estimated,
            unit_price_cents   = EXCLUDED.unit_price_cents;
    `;
  }

  return NextResponse.json({ ok: true, jobId: row.id, preauth });
}
