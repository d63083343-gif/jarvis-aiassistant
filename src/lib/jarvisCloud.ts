/**
 * Cloud-backed user data: profile, long-term memory, conversations and files.
 * Everything is scoped to the signed-in user by row-level security.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PersonaId } from "@/lib/jarvisPersonas";

export const FILES_BUCKET = "user-files";

export type Memory = { id: string; content: string; created_at: string };
export type CloudFile = {
  id: string;
  name: string;
  path: string;
  mime_type: string | null;
  size: number | null;
  kind: string;
  created_at: string;
};

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* ── Profile / persona ──────────────────────────────────────────────── */

export async function loadProfile(): Promise<{ persona: PersonaId } | null> {
  const id = await uid();
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("persona").eq("id", id).maybeSingle();
  if (!data) {
    await supabase.from("profiles").upsert({ id }).select().maybeSingle();
    return { persona: "jarvis" };
  }
  return { persona: (data.persona as PersonaId) ?? "jarvis" };
}

export async function savePersona(persona: PersonaId): Promise<void> {
  const id = await uid();
  if (!id) return;
  await supabase.from("profiles").upsert({ id, persona });
}

/* ── Long-term memory ───────────────────────────────────────────────── */

export async function listMemories(): Promise<Memory[]> {
  const { data } = await supabase
    .from("memories")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  return (data as Memory[]) ?? [];
}

export async function addMemory(content: string): Promise<void> {
  const id = await uid();
  const text = content.trim();
  if (!id || !text) return;
  const { data: existing } = await supabase
    .from("memories")
    .select("id")
    .eq("user_id", id)
    .ilike("content", text)
    .limit(1);
  if (existing?.length) return;
  await supabase.from("memories").insert({ user_id: id, content: text });
}

export async function deleteMemory(id: string): Promise<void> {
  await supabase.from("memories").delete().eq("id", id);
}

/**
 * Pulls durable facts out of a user utterance so JARVIS remembers them
 * across sessions (name, preferences, explicit "remember that…" requests).
 */
export function extractMemory(text: string): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t || t.length > 240) return null;
  const patterns: RegExp[] = [
    /\b(?:remember|note|keep in mind)\s+(?:that\s+)?(.+)/i,
    /\b(?:my name is|i am called|call me)\s+(.+)/i,
    /\b(?:i (?:live|work) (?:in|at)|i'?m from)\s+(.+)/i,
    /\b(?:i (?:like|love|prefer|hate|dislike))\s+(.+)/i,
    /\b(?:my (?:favorite|favourite)\s+\w+ is)\s+(.+)/i,
    /\b(?:i'?m a|i am a|i work as a)\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const fact = /remember|note|keep in mind/i.test(m[0])
        ? m[1]
        : m[0];
      const clean = fact.replace(/[.?!]+$/, "").trim();
      if (clean.length > 2) return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }
  return null;
}

/* ── Conversations ──────────────────────────────────────────────────── */

export async function createConversation(title?: string): Promise<string | null> {
  const id = await uid();
  if (!id) return null;
  const { data } = await supabase
    .from("conversations")
    .insert({ user_id: id, title: title ?? null })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  imageUrl?: string | null,
): Promise<void> {
  const id = await uid();
  if (!id || !conversationId) return;
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: id,
    role,
    content,
    image_url: imageUrl ?? null,
  });
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function setConversationTitle(conversationId: string, title: string): Promise<void> {
  if (!conversationId || !title.trim()) return;
  await supabase.from("conversations").update({ title: title.trim() }).eq("id", conversationId);
}

/* ── Files & images ─────────────────────────────────────────────────── */

export async function listFiles(): Promise<CloudFile[]> {
  const { data } = await supabase
    .from("user_files")
    .select("id, name, path, mime_type, size, kind, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as CloudFile[]) ?? [];
}

export async function fileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function uploadFile(file: File): Promise<CloudFile | null> {
  const id = await uid();
  if (!id) return null;
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const kind = file.type.startsWith("image/") ? "image" : "file";
  const { data } = await supabase
    .from("user_files")
    .insert({
      user_id: id,
      name: file.name,
      path,
      mime_type: file.type || null,
      size: file.size,
      kind,
    })
    .select("id, name, path, mime_type, size, kind, created_at")
    .maybeSingle();
  return (data as CloudFile) ?? null;
}

/** Persists a generated (base64 data-URL) image into cloud storage. */
export async function saveDataUrlImage(dataUrl: string, prompt: string): Promise<void> {
  try {
    const id = await uid();
    if (!id || !dataUrl.startsWith("data:")) return;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const name = `${prompt.slice(0, 40).replace(/[^\w\s-]/g, "").trim() || "image"}.png`;
    const path = `${id}/${Date.now()}-generated.png`;
    const { error } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(path, blob, { contentType: "image/png" });
    if (error) return;
    await supabase.from("user_files").insert({
      user_id: id,
      name,
      path,
      mime_type: "image/png",
      size: blob.size,
      kind: "image",
    });
  } catch {
    /* best effort */
  }
}

export async function deleteFile(file: CloudFile): Promise<void> {
  await supabase.storage.from(FILES_BUCKET).remove([file.path]);
  await supabase.from("user_files").delete().eq("id", file.id);
}
