// apps/portal/app/api/jobs/quote/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
// Use stable relatives within the portal app
import {
  DEFAULT_UNIT_PRICES,
  EXAMPLES,
  findExample,
  type ServiceCode
} from "../../../../lib/quote-examples";

export const dynamic = "force-dynamic";

const KnownCountsSchema = z.object({
  EXIT_SIGN: z.number().int().min(0).optional(),
  E_LIGHT: z.number().int().min(0).optional(),
  EXTINGUISHER: z.number().int().min(0).optional()
});

const BodySchema = z.object({
  estimateSource: z.enum(["customer_known", "example_bucket"]),
  exampleKey: z.string().optional(),
  knownCounts: KnownCountsSchema.optional(),
  unitPrices: z
    .record(z.number().int().min(0))
    .optional()
});

type QuoteItem = {
  service_code: ServiceCode;
  qty_min: number;
  qty_max: number;
  unit_price_cents: number;
  est_min_cents: number;
  est_max_cents: number;
};

function cents(n: number) {
  return Math.round(n * 100);
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => ({}));
  const body = BodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body", details: body.error.flatten() }, { status: 400 });
  }

  const unitPrices = (body.data.unitPrices || DEFAULT_UNIT_PRICES) as Record<string, number>;
  const items: QuoteItem[] = [];

  if (body.data.estimateSource === "customer_known") {
    const known = body.data.knownCounts || {};
    (["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"] as ServiceCode[]).forEach((code) => {
      const qty = (known as any)[code] ?? 0;
      const unit = unitPrices[code] ?? DEFAULT_UNIT_PRICES[code];
      const unitC = cents(unit);
      const est = qty * unitC;
      items.push({
        service_code: code,
        qty_min: qty,
        qty_max: qty,
        unit_price_cents: unitC,
        est_min_cents: est,
        est_max_cents: est
      });
    });
  } else {
    const ex = findExample(body.data.exampleKey || "");
    if (!ex) {
      return NextResponse.json(
        { error: "Unknown exampleKey", allowed: EXAMPLES.map((e) => ({ key: e.key, label: e.label })) },
        { status: 400 }
      );
    }
    (["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"] as ServiceCode[]).forEach((code) => {
      const [qmin, qmax] = ex.ranges[code];
      const unit = unitPrices[code] ?? DEFAULT_UNIT_PRICES[code];
      const unitC = cents(unit);
      items.push({
        service_code: code,
        qty_min: qmin,
        qty_max: qmax,
        unit_price_cents: unitC,
        est_min_cents: qmin * unitC,
        est_max_cents: qmax * unitC
      });
    });
  }

  const total_min_cents = items.reduce((s, i) => s + i.est_min_cents, 0);
  const total_max_cents = items.reduce((s, i) => s + i.est_max_cents, 0);
  const cap_amount_cents = Math.round(total_max_cents * 1.1);

  return NextResponse.json(
    {
      ok: true,
      estimateSource: body.data.estimateSource,
      exampleKey: body.data.exampleKey || null,
      items,
      totals: {
        total_min_cents,
        total_max_cents,
        cap_amount_cents
      },
      examples: EXAMPLES.map((e) => ({ key: e.key, label: e.label }))
    },
    { status: 200 }
  );
}
