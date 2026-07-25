import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type StorageEntry = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

const MAX_DELETE_PER_RUN = 200;
const CHAT_GRACE_MS = 24 * 60 * 60 * 1000;
const PUBLIC_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function isOlderThan(entry: StorageEntry, ageMs: number): boolean {
  const value = entry.created_at || entry.updated_at;
  return Boolean(value && Date.now() - new Date(value).getTime() >= ageMs);
}

function referencedPath(value: unknown, bucket: string): string | null {
  if (typeof value !== "string" || !value) return null;
  for (const marker of [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`]) {
    const index = value.indexOf(marker);
    if (index >= 0) return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  }
  return null;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const candidateSecret = request.headers.get("x-cleanup-secret") || "";
  if (!url || !serviceKey || !candidateSecret) return new Response("Forbidden", { status: 403 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: allowed, error: authError } = await supabase.rpc("verify_media_cleanup_secret", { p_secret: candidateSecret });
  if (authError || allowed !== true) return new Response("Forbidden", { status: 403 });

  const listFiles = async (bucket: string, prefix = "", depth = 0): Promise<Array<StorageEntry & { path: string }>> => {
    if (depth > 5) throw new Error(`Storage nesting is too deep in ${bucket}/${prefix}`);
    const files: Array<StorageEntry & { path: string }> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const entries = (data || []) as StorageEntry[];
      for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id && !entry.metadata) files.push(...await listFiles(bucket, path, depth + 1));
        else if (entry.name !== ".emptyFolderPlaceholder") files.push({ ...entry, path });
      }
      if (entries.length < 1000) break;
    }
    return files;
  };

  try {
    const chatFiles = await listFiles("chat-attachments");
    const chatCandidates = chatFiles.filter(file => /^.+\/.+\/msg_([0-9a-f-]{36})\.[a-z0-9]+$/i.test(file.path) && isOlderThan(file, CHAT_GRACE_MS));
    const messageIds = chatCandidates.map(file => file.path.match(/\/msg_([0-9a-f-]{36})\./i)?.[1]).filter(Boolean) as string[];
    const existingIds = new Set<string>();
    for (let index = 0; index < messageIds.length; index += 100) {
      const { data, error } = await supabase.from("messages").select("id").in("id", messageIds.slice(index, index + 100));
      if (error) throw error;
      for (const row of data || []) existingIds.add(row.id);
    }
    const orphanChatPaths = chatCandidates
      .filter(file => !existingIds.has(file.path.match(/\/msg_([0-9a-f-]{36})\./i)?.[1] || ""))
      .map(file => file.path);

    const [profiles, chats, stories, publicFiles] = await Promise.all([
      supabase.from("profiles").select("avatar,wallpaper"),
      supabase.from("chats").select("avatar"),
      supabase.from("stories").select("media"),
      listFiles("public-media")
    ]);
    if (profiles.error || chats.error || stories.error) throw profiles.error || chats.error || stories.error;
    const publicReferences = new Set<string>();
    for (const row of profiles.data || []) for (const value of [row.avatar, row.wallpaper]) {
      const path = referencedPath(value, "public-media"); if (path) publicReferences.add(path);
    }
    for (const row of chats.data || []) { const path = referencedPath(row.avatar, "public-media"); if (path) publicReferences.add(path); }
    for (const row of stories.data || []) { const path = referencedPath(row.media, "public-media"); if (path) publicReferences.add(path); }
    const orphanPublicPaths = publicFiles.filter(file => isOlderThan(file, PUBLIC_GRACE_MS) && !publicReferences.has(file.path)).map(file => file.path);

    const chatDeletes = orphanChatPaths.slice(0, MAX_DELETE_PER_RUN);
    const remaining = MAX_DELETE_PER_RUN - chatDeletes.length;
    const publicDeletes = orphanPublicPaths.slice(0, Math.max(0, remaining));
    if (chatDeletes.length) { const { error } = await supabase.storage.from("chat-attachments").remove(chatDeletes); if (error) throw error; }
    if (publicDeletes.length) { const { error } = await supabase.storage.from("public-media").remove(publicDeletes); if (error) throw error; }

    return Response.json({ deleted: { chatAttachments: chatDeletes.length, publicMedia: publicDeletes.length }, candidates: { chatAttachments: orphanChatPaths.length, publicMedia: orphanPublicPaths.length } });
  } catch (error) {
    console.error("media cleanup failed", error);
    return Response.json({ error: "Cleanup failed safely; no further files were removed." }, { status: 500 });
  }
});