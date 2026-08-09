import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.112.2";
import pako from "npm:pako@2.1.0";

const MAX_STICKERS = 120;
const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;
const MAX_LOTTIE_BYTES = 5 * 1024 * 1024;
const MAX_DECOMPRESSION_RATIO = 100;
const REQUEST_TIMEOUT_MS = 10_000;

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const configured = (Deno.env.get("ALLOWED_APP_ORIGINS") || "").split(",").map((item) => item.trim());
  if (configured.includes(origin)) return origin;
  if (["app://coiny", "capacitor://localhost", "https://localhost"].includes(origin)) return origin;
  try {
    const parsed = new URL(origin);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname) && ["http:", "https:"].includes(parsed.protocol)) return origin;
  } catch {
    // Rejected by the caller.
  }
  return null;
}

function responseHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

async function fetchTelegram(url: URL): Promise<Response> {
  if (url.protocol !== "https:" || url.hostname !== "api.telegram.org") throw new Error("Telegram origin rejected");
  return fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: "error" });
}

function isWebP(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

function isWebM(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

function decompressLottie(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflate = new pako.Inflate();
  inflate.onData = (chunk: Uint8Array) => {
    total += chunk.length;
    if (total > MAX_LOTTIE_BYTES || total / Math.max(bytes.length, 1) > MAX_DECOMPRESSION_RATIO) {
      throw new Error("Lottie decompression limit exceeded");
    }
    chunks.push(Uint8Array.from(chunk));
  };
  inflate.push(bytes, true);
  if (inflate.err) throw new Error("Malformed TGS archive");
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function validateLottie(bytes: Uint8Array): void {
  const document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!document || typeof document !== "object" || !Array.isArray(document.layers)) throw new Error("Malformed Lottie document");
  if (!Number.isFinite(document.w) || !Number.isFinite(document.h) || document.w < 1 || document.h < 1 || document.w > 512 || document.h > 512) {
    throw new Error("Invalid Lottie dimensions");
  }
  const stack: unknown[] = [document];
  let nodes = 0;
  while (stack.length) {
    const value = stack.pop();
    nodes += 1;
    if (nodes > 100_000) throw new Error("Lottie document is too complex");
    if (Array.isArray(value)) {
      stack.push(...value);
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (["x", "expression", "url", "href", "p", "u"].includes(key) && typeof child === "string" && child.length) {
          throw new Error("External resources and expressions are not allowed in Lottie");
        }
        stack.push(child);
      }
    } else if (typeof value === "string" && value.length > 10_000) {
      throw new Error("Lottie string value is too large");
    }
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  const corsOrigin = allowedOrigin(origin);
  if (origin && !corsOrigin) return json(403, { error: "Origin is not allowed" }, null);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(corsOrigin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, corsOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceKey || !botToken || !authorization?.startsWith("Bearer ")) {
    return json(401, { error: "Unauthorized or backend is not configured" }, corsOrigin);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json(401, { error: "Unauthorized" }, corsOrigin);

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: quotaAllowed, error: quotaError } = await service.rpc("consume_sticker_import_quota", { p_user_id: user.id });
  if (quotaError) return json(500, { error: "Import quota check failed" }, corsOrigin);
  if (quotaAllowed !== true) return json(429, { error: "Sticker import rate limit exceeded" }, corsOrigin);

  try {
    const { packName } = await request.json();
    const normalizedPackName = typeof packName === "string" ? packName.trim() : "";
    if (!/^[A-Za-z0-9_]{1,64}$/.test(normalizedPackName)) return json(400, { error: "Invalid packName" }, corsOrigin);

    const metadataUrl = new URL(`https://api.telegram.org/bot${botToken}/getStickerSet`);
    metadataUrl.searchParams.set("name", normalizedPackName);
    const metadataResponse = await fetchTelegram(metadataUrl);
    if (!metadataResponse.ok) throw new Error("Telegram metadata request failed");
    const metadata = await metadataResponse.json();
    if (!metadata.ok || !metadata.result) return json(404, { error: "Sticker pack not found" }, corsOrigin);

    const set = metadata.result;
    if (!Array.isArray(set.stickers) || set.stickers.length < 1 || set.stickers.length > MAX_STICKERS) {
      return json(400, { error: "Sticker count exceeds the supported limit" }, corsOrigin);
    }
    const isAnimated = Boolean(set.is_animated);
    const isVideo = Boolean(set.is_video);
    if (isAnimated && isVideo) throw new Error("Unsupported mixed sticker format");

    let { data: pack } = await service.from("sticker_packs").select("id").eq("name", set.name).maybeSingle();
    if (!pack) {
      const { data, error } = await service.from("sticker_packs").insert({
        name: set.name,
        title: String(set.title || set.name).slice(0, 128),
        is_animated: isAnimated,
        is_video: isVideo,
      }).select("id").single();
      if (error) throw error;
      pack = data;
    }

    const { data: existing } = await service.from("stickers").select("file_path").eq("pack_id", pack.id);
    const existingPaths = new Set((existing || []).map((row) => row.file_path));
    let imported = 0;

    for (const sticker of set.stickers) {
      if (!/^[A-Za-z0-9_-]{1,256}$/.test(String(sticker.file_id || "")) || !/^[A-Za-z0-9_-]{1,256}$/.test(String(sticker.file_unique_id || ""))) continue;
      const extension = isAnimated ? "json" : isVideo ? "webm" : "webp";
      const storagePath = `packs/${pack.id}/${sticker.file_unique_id}.${extension}`;
      if (existingPaths.has(storagePath)) continue;

      const infoUrl = new URL(`https://api.telegram.org/bot${botToken}/getFile`);
      infoUrl.searchParams.set("file_id", sticker.file_id);
      const infoResponse = await fetchTelegram(infoUrl);
      const info = infoResponse.ok ? await infoResponse.json() : null;
      const telegramPath = info?.result?.file_path;
      if (!info?.ok || typeof telegramPath !== "string" || !/^[A-Za-z0-9_./-]{1,512}$/.test(telegramPath) || telegramPath.includes("..")) continue;

      const downloadUrl = new URL(`https://api.telegram.org/file/bot${botToken}/${telegramPath}`);
      const downloadResponse = await fetchTelegram(downloadUrl);
      if (!downloadResponse.ok) continue;
      const declaredLength = Number(downloadResponse.headers.get("content-length") || 0);
      if (declaredLength > MAX_COMPRESSED_BYTES) continue;
      let bytes = new Uint8Array(await downloadResponse.arrayBuffer());
      if (bytes.length < 1 || bytes.length > MAX_COMPRESSED_BYTES) continue;

      let contentType = "image/webp";
      if (isAnimated) {
        bytes = decompressLottie(bytes);
        validateLottie(bytes);
        contentType = "application/json";
      } else if (isVideo) {
        if (!isWebM(bytes)) continue;
        contentType = "video/webm";
      } else if (!isWebP(bytes)) {
        continue;
      }

      const { error: uploadError } = await service.storage.from("stickers").upload(storagePath, bytes, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) continue;
      const { error: insertError } = await service.from("stickers").insert({
        pack_id: pack.id,
        emoji: String(sticker.emoji || "").slice(0, 32),
        file_path: storagePath,
        width: Math.min(512, Math.max(1, Number(sticker.width) || 512)),
        height: Math.min(512, Math.max(1, Number(sticker.height) || 512)),
      });
      if (insertError) {
        await service.storage.from("stickers").remove([storagePath]);
        continue;
      }
      imported += 1;
    }

    await service.from("user_sticker_packs").upsert({ user_id: user.id, pack_id: pack.id }, { onConflict: "user_id,pack_id" });
    return json(200, { success: true, packId: pack.id, title: set.title, imported }, corsOrigin);
  } catch (error) {
    console.error("Sticker import failed", error instanceof Error ? error.message : "unknown error");
    return json(500, { error: "Sticker import failed" }, corsOrigin);
  }
});
