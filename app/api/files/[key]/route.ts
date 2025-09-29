// app/api/files/[key]/route.ts
/* GET /api/files/:key
 * - Requires an authenticated session (returns 403 if unauthenticated).
 * - Streams the object from R2 with server-side SigV4 (no client creds).
 *
 * Auth note:
 * We attempt to use a root shim at "@/lib/auth" if present. If unavailable
 * or it returns no user, we treat the request as unauthenticated (403).
 */
import { NextRequest } from "next/server";
import { signHeadersForGet } from "@/lib/r2-signer";

export const runtime = "nodejs";

async function isAuthed(req: NextRequest): Promise<boolean> {
  try {
    // Dynamically import to avoid type coupling; tolerate differing exports.
    // Expected shape: getSession(req) -> { user?: any } or similar.
    const mod: any = await import("@/lib/auth");
    const fn = mod?.getSession || mod?.requireSession || mod?.session;
    if (typeof fn === "function") {
      const sess = await fn(req);
      // Accept common shapes: { user }, { id }, truthy object
      return Boolean(sess && (sess.user || sess.id || Object.keys(sess).length));
    }
  } catch {
    // ignore; fall through to false
  }
  return false;
}

export async function GET(req: NextRequest, ctx: { params: { key: string[] | string } }) {
  const authed = await isAuthed(req);
  if (!authed) {
    return new Response("Forbidden", { status: 403 });
  }

  const param = ctx.params.key;
  const key = Array.isArray(param) ? param.join("/") : param;

  try {
    const { url, headers } = signHeadersForGet(key);
    const upstream = await fetch(url, { headers });
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: "upstream_error", status: upstream.status }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    // Pass through content-type/length if known for better UX
    const passthroughHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    const cl = upstream.headers.get("content-length");
    if (ct) passthroughHeaders.set("content-type", ct);
    if (cl) passthroughHeaders.set("content-length", cl);
    passthroughHeaders.set("cache-control", "private, max-age=0, must-revalidate");

    return new Response(upstream.body, {
      status: 200,
      headers: passthroughHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "stream_failed", message: err?.message || "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
