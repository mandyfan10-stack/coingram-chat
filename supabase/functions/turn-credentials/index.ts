import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.112.2";

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const configured = (Deno.env.get("ALLOWED_APP_ORIGINS") || "").split(",").map((entry) => entry.trim());
  if (configured.includes(origin) || ["app://coiny", "capacitor://localhost", "https://localhost"].includes(origin)) return origin;
  try {
    const parsed = new URL(origin);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname) && ["http:", "https:"].includes(parsed.protocol)) return origin;
  } catch { /* rejected */ }
  return null;
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin)
  });
}

Deno.serve(async (request: Request) => {
  const requestOrigin = request.headers.get("Origin");
  const origin = allowedOrigin(requestOrigin);
  if (requestOrigin && !origin) return json(403, { error: "Origin is not allowed" }, null);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !authorization?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" }, origin);

  const auth = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return json(401, { error: "Unauthorized" }, origin);

  const sharedSecret = Deno.env.get("TURN_SHARED_SECRET");
  const turnUrls = (Deno.env.get("TURN_URLS") || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!sharedSecret || !turnUrls.length) return json(200, { available: false, reason: "TURN is not configured" }, origin);
  if (turnUrls.some((entry) => !/^turns?:[^\s]+$/i.test(entry))) return json(500, { error: "TURN_URLS is invalid" }, origin);

  const expiresAtSeconds = Math.floor(Date.now() / 1000) + 600;
  const username = `${expiresAtSeconds}:${user.id}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sharedSecret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username)));
  const credential = btoa(String.fromCharCode(...signature));
  return json(200, {
    available: true,
    expiresAt: expiresAtSeconds * 1000,
    iceServers: [{ urls: turnUrls, username, credential }]
  }, origin);
});
