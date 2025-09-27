// app/api/files/upload/route.ts
import { NextResponse } from "next/server";
import { presignS3Url } from "@/lib/r2-signer";

export const dynamic = "force-dynamic";

/**
 * Request: JSON { filename: string }  (optional: contentType)
 * Response: 200 { r2Key, url }  — client PUTs file bytes to `url`
 */
export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json().catch(() => ({}));
    if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

    const key = `${Date.now()}-${filename}`; // simple unique-ish key

    const url = presignS3Url({
      method: "PUT",
      bucket: mustEnv("R2_BUCKET"),
      key,
      endpoint: mustEnv("R2_ENDPOINT"),
      region: mustEnv("R2_REGION"),
      accessKeyId: mustEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: mustEnv("R2_SECRET_ACCESS_KEY"),
      expiresIn: 900,
      contentType
    });

    return NextResponse.json({ r2Key: key, url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
