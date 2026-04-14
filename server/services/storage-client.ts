import { put, del } from "@vercel/blob";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Supabase (art files — signed URLs) ──────────────────────────

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  supabase = createClient(url, key);
  return supabase;
}

const ART_BUCKET = "art-files";

export async function uploadArtFile({
  buffer,
  mimetype,
  originalname,
  orderId,
  orderItemId,
}: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  orderId: string;
  orderItemId: string;
}): Promise<string> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase Storage não configurado");

  const timestamp = Date.now();
  const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `orders/${orderId}/${orderItemId}/${timestamp}-${safeName}`;

  const { error } = await client.storage.from(ART_BUCKET).upload(path, buffer, {
    contentType: mimetype,
    upsert: false,
  });

  if (error) throw new Error(`Upload falhou: ${error.message}`);

  const { data } = client.storage.from(ART_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function getSignedArtUrl(filePath: string): Promise<string> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase Storage não configurado");

  const { data, error } = await client.storage
    .from(ART_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error || !data?.signedUrl) throw new Error(`Signed URL falhou: ${error?.message}`);
  return data.signedUrl;
}

// ── Vercel Blob (product/addon images) ──────────────────────────

export async function uploadProductImage(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN não configurado no .env");

  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `product-images/${timestamp}-${safeName}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimetype,
    token,
  });

  return blob.url;
}

export async function deleteProductImage(url: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;

  try {
    await del(url, { token });
  } catch {
    // ignore deletion errors
  }
}
