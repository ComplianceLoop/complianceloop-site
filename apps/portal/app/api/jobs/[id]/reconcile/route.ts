// apps/portal/app/api/jobs/[id]/reconcile/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
// From this file to apps/portal/lib/neon.ts is 5 levels up
// route.ts -> reconcile -> [id] -> jobs -> api -> app  => ../../../../../lib/neon
import { getSql } from "../../../../../lib/neon";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  items: z.array(
    z.object({
      service_code: z.enum(["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"]),
      quantity_confirmed: z.number().int().min(0)
    })
  )
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  const json = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const sql = getSql();

  // Update job_items with confirmed counts
  for (const item of parsed.data.items) {
    await sql`
      update job_items
      set quantity_confirmed = ${item.quantity_confirmed}
      where job_id = ${jobId} and service_code = ${item.service_code};
    `;

    // Upsert into customer_assets for prefill next time
    const job = await sql<[{ customer_email: string; site_label: string | null }]>`
      select customer_email, site_label from jobs where id = ${jobId} limit 1;
    `;
    const email = job[0]?.customer_email;
    const site = job[0]?.site_label || null;

    await sql`
      insert into customer_assets (customer_email, site_label, service_code, last_confirmed_qty)
      values (${email}, ${site}, ${item.service_code}, ${item.quantity_confirmed})
      on conflict (customer_email, coalesce(site_label, ''), service_code)
      do update set last_confirmed_qty = excluded.last_confirmed_qty, updated_at = now();
    `;
  }

  return NextResponse.json({ ok: true, jobId, updated: parsed.data.items.length }, { status: 200 });
}
