import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function getStorageSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 60 * 60,
) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      console.warn(`Unable to create signed URL for ${bucket}/${path}:`, error?.message);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.warn(`Unable to access ${bucket}/${path}:`, error);
    return null;
  }
}