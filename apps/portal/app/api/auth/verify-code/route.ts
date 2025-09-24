import { db } from "@/app/../lib/db";
import { loginCodes, customers } from "@/app/../db/schema";
import { and, eq, gt } from "drizzle-orm";
import { createSession } from "@/app/../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { email, code } = await request.json();
  if (!(email && code)) return new Response("bad request", { status: 400 });

  const rows = await db.select().from(loginCodes).where(
    and(eq(loginCodes.email, email), eq(loginCodes.code, code), gt(loginCodes.expiresAt, new Date()))
  ).limit(1);

  if (rows.length === 0) return new Response("invalid code", { status: 401 });

  // Attach to existing customer if one exists
  const cust = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  const customerId = cust[0]?.id;

  await createSession(email, customerId);
  // burn code
  await db.delete(loginCodes).where(eq(loginCodes.email, email));

  return new Response("ok");
}
