import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.112.2";
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.42";

const wasmBytes = await Deno.readFile(
  new URL("magick.wasm", import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.42")),
);
await initializeImageMagick(wasmBytes);

type MediaKind = "avatar" | "story" | "wallpaper" | "banner" | "group-avatar";

const MAX_PIXELS = 16_000_000;
const MAX_DIMENSION = 4096;
const MAX_DECOMPRESSION_RATIO = 2000;
const KIND_CONFIG: Record<MediaKind, { bucket: string; maxBytes: number; prefix: string; minRatio?: number; maxRatio?: number }> = {
  avatar: { bucket: "avatars", maxBytes: 5 * 1024 * 1024, prefix: "avatar" },
  story: { bucket: "stories", maxBytes: 10 * 1024 * 1024, prefix: "story" },
  wallpaper: { bucket: "wallpapers", maxBytes: 10 * 1024 * 1024, prefix: "wallpaper" },
  banner: { bucket: "banners", maxBytes: 10 * 1024 * 1024, prefix: "banner", minRatio: 1.2, maxRatio: 6 },
  "group-avatar": { bucket: "group-avatars", maxBytes: 5 * 1024 * 1024, prefix: "avatar" },
};

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const configured = (Deno.env.get("ALLOWED_APP_ORIGINS") || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return origin;
  if (["app://coiny", "capacitor://localhost", "https://localhost"].includes(origin)) return origin;
  try {
    const parsed = new URL(origin);
    if (["http:", "https:"].includes(parsed.protocol) && ["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      return origin;
    }
  } catch {
    // Rejected below.
  }
  return null;
}

function headers(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

function detectedMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 16 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp") {
    const brand = new TextDecoder().decode(bytes.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

function sanitizeImage(bytes: Uint8Array): { output: Uint8Array; width: number; height: number } {
  return ImageMagick.read(bytes, (image) => {
    const width = image.width;
    const height = image.height;
    if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
      throw new Error("Image dimensions exceed the allowed limit");
    }
    if ((width * height * 4) / Math.max(bytes.length, 1) > MAX_DECOMPRESSION_RATIO) {
      throw new Error("Suspicious image decompression ratio");
    }
    image.autoOrient();
    image.strip();
    image.quality = 82;
    const output = image.write(MagickFormat.WebP, (data) => Uint8Array.from(data));
    return { output, width, height };
  });
}

Deno.serve(async (request: Request) => {
  const requestOrigin = request.headers.get("Origin");
  const corsOrigin = allowedOrigin(requestOrigin);
  if (requestOrigin && !corsOrigin) return json(403, { error: "Origin is not allowed" }, null);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(corsOrigin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, corsOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization?.startsWith("Bearer ")) {
    return json(401, { error: "Unauthorized" }, corsOrigin);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json(401, { error: "Unauthorized" }, corsOrigin);

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: quotaAllowed, error: quotaError } = await service.rpc("consume_media_upload_quota", {
    p_user_id: user.id,
  });
  if (quotaError) return json(500, { error: "Upload quota check failed" }, corsOrigin);
  if (quotaAllowed !== true) return json(429, { error: "Upload rate limit exceeded" }, corsOrigin);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    const chatId = form.get("chatId");
    if (!(file instanceof File) || typeof kind !== "string" || !(kind in KIND_CONFIG)) {
      return json(400, { error: "A supported image file and media kind are required" }, corsOrigin);
    }

    const mediaKind = kind as MediaKind;
    const config = KIND_CONFIG[mediaKind];
    if (file.size < 1 || file.size > config.maxBytes) return json(413, { error: "Image is too large" }, corsOrigin);
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      return json(415, { error: "Unsupported image MIME type" }, corsOrigin);
    }

    if (mediaKind === "group-avatar") {
      if (typeof chatId !== "string" || !/^[0-9a-f-]{36}$/i.test(chatId)) {
        return json(400, { error: "A valid chatId is required" }, corsOrigin);
      }
      const [{ data: membership }, { data: chat }] = await Promise.all([
        service.from("chat_members").select("role").eq("chat_id", chatId).eq("profile_id", user.id).maybeSingle(),
        service.from("chats").select("created_by").eq("id", chatId).maybeSingle(),
      ]);
      if (membership?.role !== "admin" && chat?.created_by !== user.id) {
        return json(403, { error: "Only chat administrators can update this avatar" }, corsOrigin);
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (detectedMime(bytes) !== file.type) return json(415, { error: "File signature does not match its MIME type" }, corsOrigin);
    const { output, width, height } = sanitizeImage(bytes);
    const ratio = width / height;
    if (
      (config.minRatio && ratio < config.minRatio)
      || (config.maxRatio && ratio > config.maxRatio)
    ) {
      return json(400, { error: "Image aspect ratio is not allowed for this slot" }, corsOrigin);
    }
    const ownerPrefix = mediaKind === "group-avatar" ? String(chatId) : user.id;
    const path = `${ownerPrefix}/${config.prefix}_${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await service.storage.from(config.bucket).upload(path, output, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const reference = `storage://${config.bucket}/${path}`;
    let metadataError = null;
    if (mediaKind === "avatar") {
      ({ error: metadataError } = await service.from("profiles").update({ avatar: reference, avatar_path: path }).eq("id", user.id));
    } else if (mediaKind === "wallpaper") {
      ({ error: metadataError } = await service.from("profiles").update({ wallpaper: reference, wallpaper_path: path }).eq("id", user.id));
    } else if (mediaKind === "banner") {
      ({ error: metadataError } = await service.from("profiles").update({ banner: reference, banner_path: path }).eq("id", user.id));
    } else if (mediaKind === "group-avatar") {
      ({ error: metadataError } = await service.from("chats").update({ avatar: reference, avatar_path: path }).eq("id", chatId));
    }
    if (metadataError) {
      await service.storage.from(config.bucket).remove([path]);
      throw metadataError;
    }

    return json(200, { path, reference, mimeType: "image/webp", size: output.length, width, height }, corsOrigin);
  } catch (error) {
    console.error("sanitize-public-image failed", error instanceof Error ? error.message : "unknown error");
    return json(400, { error: error instanceof Error ? error.message : "Image processing failed" }, corsOrigin);
  }
});
