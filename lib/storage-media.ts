import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function isStorageConfigured() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  return Boolean(supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getStorageSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 60 * 60,
) {
  // Landing media is optional. Avoid treating a deliberately unconfigured
  // local/CI environment as a storage failure; configured storage failures
  // still remain visible so production regressions are diagnosable.
  if (!isStorageConfigured()) {
    return null;
  }

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
