import type { SupabaseClient } from "@supabase/supabase-js";

// Returns the Supabase client (client-safe and server-safe)
export const useSupabase = (): SupabaseClient => {
  return useSupabaseClient(); // This should auto-import from @nuxtjs/supabase
};

// Creates a user-specific folder in the given bucket if it doesn't exist
export async function setupUserStorage(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const bucket = "users";
  const uploadPath = `${userId}/.init`;
  const initBlob = new Blob(["init"], { type: "text/plain" });

  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(uploadPath, initBlob, { upsert: false });

  if (uploadError && !uploadError.message.includes("already exists")) {
    console.error("[setupUserStorage] uploadError:", uploadError);
    throw uploadError;
  }
}
