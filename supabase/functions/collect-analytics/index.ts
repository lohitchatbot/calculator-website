const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKey = Deno.env.get("EASYCALC_PUBLISHABLE_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const siteOrigin = Deno.env.get("SITE_ORIGIN") ?? "";
const hashSecret = Deno.env.get("ANALYTICS_HASH_SECRET") ?? "";

const allowedActions = new Set(["start", "ping", "end", "forget"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respond(status: number, origin: string | null) {
  const headers = new Headers({
    "cache-control": "no-store",
    vary: "Origin",
  });
  if (origin && origin === siteOrigin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type, apikey");
    headers.set("access-control-max-age", "600");
  }
  return new Response(null, { status, headers });
}

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hashSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!siteOrigin || origin !== siteOrigin) return respond(403, null);
    return respond(204, origin);
  }
  if (request.method !== "POST") return respond(405, origin);
  if (!siteOrigin || origin !== siteOrigin) return respond(403, null);
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || hashSecret.length < 32) {
    console.error("Analytics collector is missing server configuration.");
    return respond(503, origin);
  }
  if (request.headers.get("apikey") !== publishableKey) return respond(401, origin);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 512) return respond(413, origin);

  let payload: Record<string, unknown>;
  try {
    const body = await readBoundedBody(request, 512);
    if (body === null) return respond(413, origin);
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return respond(400, origin);
    payload = parsed as Record<string, unknown>;
  } catch {
    return respond(400, origin);
  }

  const keys = Object.keys(payload);
  if (keys.length !== 3 || keys.some((key) => !["visitor_id", "session_id", "action"].includes(key))) {
    return respond(400, origin);
  }
  const visitorId = typeof payload.visitor_id === "string" ? payload.visitor_id : "";
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!uuidPattern.test(visitorId) || !uuidPattern.test(sessionId) || !allowedActions.has(action)) {
    return respond(400, origin);
  }

  try {
    const [visitorHash, sessionHash] = await Promise.all([
      hmacHex(`visitor:${visitorId}`),
      hmacHex(`session:${sessionId}`),
    ]);
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/update_analytics_presence`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_visitor_id: visitorHash,
        p_session_id: sessionHash,
        p_action: action,
      }),
    });
    if (!response.ok) {
      console.error("Analytics presence update failed.", response.status);
      return respond(502, origin);
    }
    return respond(204, origin);
  } catch (error) {
    console.error("Analytics presence update failed.", error);
    return respond(502, origin);
  }
});
