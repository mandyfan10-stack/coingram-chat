import { createClient } from "npm:@supabase/supabase-js@2.110.0"
import pako from "npm:pako@2.1.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { packName } = await req.json();
    const normalizedPackName = typeof packName === 'string' ? packName.trim() : '';
    if (!/^[A-Za-z0-9_]{1,64}$/.test(normalizedPackName)) {
      return new Response(JSON.stringify({ error: "Invalid packName" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Required Supabase secrets are not configured');
    }

    if (!authorization?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve identity from the signed JWT. Never trust a user id supplied by the client.
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN secret not configured on backend" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Admin access is used only after the caller has been authenticated.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch metadata from Telegram Bot API
    console.log(`Fetching sticker set info for: ${normalizedPackName}...`);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(normalizedPackName)}`);
    const data = await res.json();
    
    if (!data.ok) {
      return new Response(JSON.stringify({ error: `Telegram Bot API Error: ${data.description || 'Sticker pack not found'}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const set = data.result;
    const isAnimated = !!set.is_animated;
    const isVideo = !!set.is_video;

    // 2. Insert or get Sticker Pack in DB
    let packId;
    const { data: existingPack } = await supabase
      .from("sticker_packs")
      .select("id")
      .eq("name", set.name)
      .maybeSingle();

    if (existingPack) {
      packId = existingPack.id;
      console.log(`Sticker pack ${set.name} already exists with ID: ${packId}`);
    } else {
      const { data: newPack, error: packErr } = await supabase
        .from("sticker_packs")
        .insert({
          name: set.name,
          title: set.title,
          is_animated: isAnimated,
          is_video: isVideo
        })
        .select("id")
        .single();
      
      if (packErr) throw packErr;
      packId = newPack.id;
      console.log(`Created new sticker pack in DB: ${set.name} -> ID: ${packId}`);
    }

    // 3. Import individual stickers
    console.log(`Processing ${set.stickers.length} stickers...`);
    
    // Fetch existing stickers for this pack to avoid duplicate download & upload
    const { data: existingStickers } = await supabase
      .from("stickers")
      .select("file_path")
      .eq("pack_id", packId);
    
    const existingPaths = new Set(existingStickers?.map(s => s.file_path) || []);

    for (const sticker of set.stickers) {
      const fileId = sticker.file_id;
      const fileUniqueId = sticker.file_unique_id;
      
      let finalExtension = "webp";
      if (isAnimated) {
        finalExtension = "json";
      } else if (isVideo) {
        finalExtension = "webm";
      }
      
      const storagePath = `packs/${packId}/${fileUniqueId}.${finalExtension}`;

      // Check if already in DB
      if (existingPaths.has(storagePath)) {
        console.log(`Sticker ${fileUniqueId} already exists, skipping download.`);
        continue;
      }

      // Get file URL from Telegram
      const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileInfo = await fileInfoRes.json();
      if (!fileInfo.ok) {
        console.warn(`Failed to get file info for sticker ${fileUniqueId}:`, fileInfo.description);
        continue;
      }

      const filePathOnTelegram = fileInfo.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePathOnTelegram}`;
      
      // Download file bytes
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) {
        console.warn(`Failed to download sticker file from ${downloadUrl}`);
        continue;
      }
      
      let fileBytes = new Uint8Array(await downloadRes.arrayBuffer());
      let contentType = "image/webp";

      if (isAnimated) {
        // Decompress TGS (gzipped JSON) using pako to raw Lottie JSON
        try {
          const decompressed = pako.ungzip(fileBytes, { to: 'string' });
          fileBytes = new TextEncoder().encode(decompressed);
          contentType = "application/json";
        } catch (e) {
          console.error(`Decompression failed for sticker ${fileUniqueId}, uploading as raw:`, e);
          contentType = "application/json";
        }
      } else if (isVideo) {
        contentType = "video/webm";
      }

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from("stickers")
        .upload(storagePath, fileBytes, {
          contentType,
          upsert: true
        });

      if (uploadErr) {
        console.error(`Storage upload error for sticker ${fileUniqueId}:`, uploadErr);
        continue;
      }

      // Insert sticker record to DB
      const { error: stickerErr } = await supabase
        .from("stickers")
        .insert({
          pack_id: packId,
          emoji: sticker.emoji || '',
          file_path: storagePath,
          width: sticker.width || 512,
          height: sticker.height || 512
        });

      if (stickerErr) {
        console.error(`Database insert error for sticker ${fileUniqueId}:`, stickerErr);
      }
    }

    // 4. Link the authenticated caller to the pack.
    const { error: userPackErr } = await supabase
      .from("user_sticker_packs")
      .upsert({
        user_id: user.id,
        pack_id: packId
      }, { onConflict: 'user_id,pack_id' });

    if (userPackErr) {
      throw userPackErr;
    }

    return new Response(JSON.stringify({ success: true, packId, title: set.title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Function error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
