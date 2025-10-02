// apps/portal/app/api/providers/bootstrap/route.ts
// Optional: executes the bootstrap DDL to ensure provider tables exist.
import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/neon";
import bootstrap from "../../../../db/bootstrap.sql";

export const dynamic = "force-dynamic";

export async function POST() {
  const sql = getSql();
  await sql`${bootstrap}`;
  return NextResponse.json({ ok: true });
}
