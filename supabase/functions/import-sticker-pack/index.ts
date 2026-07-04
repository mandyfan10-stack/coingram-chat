import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.11.0"
import pako from "https://esm.sh/pako@2.1.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { packName, userId } = await req.json();
    if (!packName) {
      return new Response(JSON.stringify({ error: "Missing packName" }), {
        status: 400,
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

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch metadata from Telegram Bot API
    console.log(`Fetching sticker set info for: ${packName}...`);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${packName}`);
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

    // 4. Link user to pack if userId is provided
    if (userId) {
      const { error: userPackErr } = await supabase
        .from("user_sticker_packs")
        .insert({
          user_id: userId,
          pack_id: packId
        });
      
      if (userPackErr && userPackErr.code !== '23505') { // Ignore unique constraint conflict
        console.error(`Failed to link user ${userId} to pack ${packId}:`, userPackErr);
      }
    }

    return new Response(JSON.stringify({ success: true, packId, title: set.title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
