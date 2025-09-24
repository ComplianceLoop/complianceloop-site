import { db } from "@/app/../lib/db";
import { loginCodes } from "@/app/../db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

function generateCode(){ return (Math.floor(100000 + Math.random()*900000)).toString(); }

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) return new Response("email required", { status: 400 });

  const code = process.env.VERCEL_ENV !== "production" || process.env.TEST_MODE === "true"
    ? "000000"
    : generateCode();

  const expiresAt = new Date(Date.now() + 10*60*1000);
  // simple upsert per email (one active code)
  await db.delete(loginCodes).where(eq(loginCodes.email, email));
  await db.insert(loginCodes).values({ email, code, expiresAt });

  if (process.env.VERCEL_ENV === "production") {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      const resend = new Resend(key);
      await resend.emails.send({
        from: "ComplianceLoop <no-reply@complianceloop.com>",
        to: email,
        subject: "Your ComplianceLoop sign-in code",
        text: `Your code is ${code} (valid for 10 minutes).`
      });
    }
  }
  return new Response("ok");
}
