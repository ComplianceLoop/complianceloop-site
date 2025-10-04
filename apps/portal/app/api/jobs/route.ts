// apps/portal/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSql } from "../../../lib/neon"; // correct relative path from /app/api/jobs/route.ts

type Totals = {
  total_min_cents?: number | null;
  total_max_cents?: number | null;
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
  siteLabel?: string | null;
  estimateSource: string;
  exampleKey?: string | null;
  items?: Item[];
  totals: Totals;
};

function badRequest(message = "bad_request") {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}
function serverError(message: string, detail?: unknown) {
  return NextResponse.json({ ok: false, error: "server_error", message, detail }, { status: 500 });
}

export async function POST(request: Request) {
  const sql = getSql();

  // Parse+validate input
  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return badRequest();
  }

  if (!body?.customerEmail || !body?.totals || typeof body.totals.cap_amount_cents !== "number") {
    return badRequest();
  }

  // Create Stripe PaymentIntent for the cap amount (preauth-like)
  let pi: Stripe.Response<Stripe.PaymentIntent>;
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Missing STRIPE_SECRET_KEY");

    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" } as any);
    pi = await stripe.paymentIntents.create({
      amount: body.totals.cap_amount_cents,
      currency: "usd",
      metadata: {
        source: "complianceloop_portal",
        estimate_source: body.estimateSource ?? "",
      },
    });
  } catch (err) {
    console.error("stripe preauth error", err);
    return serverError("Stripe preauth failed", (err as Error)?.message ?? String(err));
  }

  // Insert job row using Neon tagged template (avoids the multi-args type error)
  let jobId: string;
  try {
    const rows = await sql<{ id: string }>`
      INSERT INTO jobs (
        customer_email,
        site_label,
        total_min_cents,
        total_max_cents,
        cap_amount_cents,
        estimate_source,
        example_key,
        preauth_id
      )
      VALUES (
        ${body.customerEmail},
        ${body.siteLabel ?? null},
        ${body.totals.total_min_cents ?? null},
        ${body.totals.total_max_cents ?? null},
        ${body.totals.cap_amount_cents},
        ${body.estimateSource},
        ${body.exampleKey ?? null},
        ${pi.id}
      )
      RETURNING id;
    `;
    jobId = rows[0].id;
  } catch (err) {
    console.error("jobs insert error", err);
    return serverError("Failed to create job row", (err as Error)?.message ?? String(err));
  }

  // Optionally upsert job items (one statement per call for Neon)
  try {
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
  } catch (err) {
    console.error("job_items upsert error", err);
    // Not fatal for the job itself — return success with a warning
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
        warning: "items_upsert_failed",
      },
      { status: 200 }
    );
  }

  // Success response
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
}
