// apps/portal/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import StripeType from "stripe";
import { getSql } from "../../../lib/neon"; // relative to apps/portal/app/api/jobs/route.ts

// NOTE: Do NOT import raw .sql files here. Webpack will try to parse them as JS and fail.
// All bootstrapping should live in /apps/portal/db/bootstrap.sql and be executed server-side on cold start.

type Totals = {
  total_min_cents: number;
  total_max_cents: number;
  cap_amount_cents: number;
};

type Item = {
  code: string; // e.g., "EXIT_SIGN", "E_LIGHT"
  qty_min: number;
  qty_max: number;
  unit_price_cents: number;
};

type CreateJobBody = {
  customerEmail: string;
  siteLabel?: string;
  estimateSource: string;
  exampleKey?: string | null;
  items?: Item[];
  totals: Totals;
};

function serverError(message: string, detail?: unknown) {
  return NextResponse.json({ ok: false, error: "server_error", message, detail }, { status: 500 });
}

export async function POST(request: Request) {
  const sql = getSql();

  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Basic validation (lightweight on purpose)
  if (!body?.customerEmail || !body?.totals || typeof body.totals.cap_amount_cents !== "number") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // 1) Create a Stripe PaymentIntent for the cap (pre-auth style hold)
  //    In test/sandbox this will remain `requires_payment_method` until you attach a test card.
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY env var");

    const Stripe = StripeType as unknown as typeof StripeType;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });

    const pi = await stripe.paymentIntents.create({
      amount: body.totals.cap_amount_cents,
      currency: "usd",
      // You can attach metadata you want to see in the dashboard:
      metadata: {
        source: "complianceloop_portal",
        estimate_source: body.estimateSource ?? "",
      },
    });

    // 2) Insert the job row
    const [jobRow] = await sql<{ id: string }>`
      INSERT INTO jobs (
        customer_email,
        site_label,
        cap_amount_cents,
        estimate_source,
        stripe_pi_id
      )
      VALUES (
        ${body.customerEmail},
        ${body.siteLabel ?? null},
        ${body.totals.cap_amount_cents},
        ${body.estimateSource},
        ${pi.id}
      )
      RETURNING id;
    `;

    const jobId = jobRow.id;

    // 3) Upsert items, if provided (safe to skip)
    if (Array.isArray(body.items) && body.items.length) {
      for (const it of body.items) {
        await sql`
          INSERT INTO job_items (
            job_id, service_code, qty_min, qty_max, unit_price_cents
          )
          VALUES (
            ${jobId}, ${it.code}, ${it.qty_min}, ${it.qty_max}, ${it.unit_price_cents}
          )
          ON CONFLICT (job_id, service_code) DO UPDATE SET
            qty_min = EXCLUDED.qty_min,
            qty_max = EXCLUDED.qty_max,
            unit_price_cents = EXCLUDED.unit_price_cents;
        `;
      }
    }

    // 4) Respond
    return NextResponse.json(
      {
        ok: true,
        jobId,
        preauth: {
          mode: "payment_intent",
          id: pi.id,
          client_secret: pi.client_secret ?? null,
          status: pi.status,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("jobs/create error", err);
    return serverError("Failed to create job", (err as Error)?.message ?? String(err));
  }
}
