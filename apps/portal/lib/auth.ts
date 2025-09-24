import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { db } from "./db";
import { sessions } from "../db/schema";
import { eq, lt } from "drizzle-orm";

const SESSION_COOKIE = "cl_session";
const TTL_MINUTES = Number(process.env.AUTH_SESSION_TTL_MINUTES ?? "1440");

export async function createSession(email: string, customerId?: number) {
  const token = randomUUID();
  const expires = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await db.insert(sessions).values({ email, customerId, token, expiresAt: expires });
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, expires });
}

export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  if (rows.length === 0) return null;
  if (rows[0].expiresAt && rows[0].expiresAt < new Date()) return null;
  return rows[0];
}

export async function cleanupSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
