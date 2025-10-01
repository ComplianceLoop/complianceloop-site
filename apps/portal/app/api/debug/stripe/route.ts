// apps/portal/app/api/debug/stripe/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY;
  // Do NOT return the key—only metadata
  const envSeen = typeof key === "string";
  const envLen = envSeen ? key!.length : 0;
  return NextResponse.json({ envSeen, envLen });
}
