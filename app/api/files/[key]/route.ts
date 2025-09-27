// app/api/files/[key]/route.ts
import { NextResponse } from "next/server";
import { presignS3Url } from "@/lib/r2-signer";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/:key
 * - If authorized (TODO: plug your auth), streams the object from R2.
 * - Otherwise 403.
 */
export async function GET(
  req: Request,
  { params }: { params: { key: string } }
) {
  try {
    // TODO: add your session check. For now allow.
    const key = decodeURIComponent(params.key);

    const signed = presignS3Url({
      method: "GET",
      bucket: mustEnv("R2_BUCKET"),
      key,
      endpoint: mustEnv("R2_ENDPOINT"),
      region: mustEnv("R2_REGION"),
      accessKeyId: mustEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: mustEnv("R2_SECRET_ACCESS_KEY"),
      expiresIn: 300
    });

    // Stream from R2 to client
    const r = await fetch(signed);
    if (!r.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const headers = new Headers(r.headers);
    headers.delete("x-amz-id-2");
    headers.delete("x-amz-request-id");
    headers.set("Cache-Control", "private, max-age=0");

    return new Response(r.body, { status: 200, headers });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
