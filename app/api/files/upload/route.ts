// app/api/files/upload/route.ts
/* POST /api/files/upload
 * Body (optional JSON): { contentType?: string, keyHint?: string }
 * Response: { r2Key: string, putUrl: string, expiresSeconds: number }
 *
 * Notes:
 * - Returns a presigned PUT URL for direct-to-R2 uploads.
 * - We do NOT store any metadata here; this is a utility presign endpoint.
 * - GET streaming is protected in /api/files/[key]; this endpoint may be left open or gated later.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { presignUrl } from "@/lib/r2-signer";

export const runtime = "nodejs";

type Body = {
  contentType?: string;
  keyHint?: string;
};

function safeExtFromContentType(ct?: string): string {
  if (!ct) return "";
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
  };
  return map[ct] || "";
}

function newKey(keyHint?: string, ext?: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const base = keyHint?.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+/, "").slice(0, 120) || "uploads";
  return `${yyyy}/${mm}/${dd}/${base}/${randomUUID()}${ext || ""}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const contentType = body.contentType?.trim();
    const ext = safeExtFromContentType(contentType);
    const r2Key = newKey(body.keyHint, ext);

    const putUrl = presignUrl({
      method: "PUT",
      key: r2Key,
      expiresSeconds: 900,
      contentType: contentType || undefined,
    });

    return NextResponse.json({ r2Key, putUrl, expiresSeconds: 900 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "presign_failed", message: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
