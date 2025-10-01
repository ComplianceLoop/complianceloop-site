// apps/portal/app/api/customers/assets/route.ts
import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/neon";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const site = url.searchParams.get("site") ?? "";
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const sql = getSql();
  const rows = await sql`
    select service_code, last_confirmed_qty
    from customer_assets
    where customer_email = ${email} and site_label = ${site}
    order by service_code;
  `;

  return NextResponse.json({ ok: true, email, site, items: rows }, { status: 200 });
}
