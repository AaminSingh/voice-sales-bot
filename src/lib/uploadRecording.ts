import { getSupabase } from "./supabase";

/**
 * Uploads an audio recording Blob to Supabase Storage in the "call-recordings" bucket.
 *
 * @param blob The audio recording Blob
 * @param mimeType The recorded mime type (e.g. "audio/webm;codecs=opus")
 * @returns The public URL of the uploaded recording
 */
export async function uploadRecording(blob: Blob, mimeType: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  // Determine extension based on mimeType
  let ext = "webm";
  if (mimeType.includes("mp4")) {
    ext = "mp4";
  } else if (mimeType.includes("m4a")) {
    ext = "m4a";
  } else if (mimeType.includes("wav")) {
    ext = "wav";
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const filePath = `calls/${timestamp}-${randomSuffix}.${ext}`;

  const contentType = mimeType.split(";")[0] || (ext === "mp4" ? "audio/mp4" : "audio/webm");

  const { error: uploadError } = await supabase.storage
    .from("call-recordings")
    .upload(filePath, blob, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("[uploadRecording] Failed to upload audio recording:", uploadError);
    throw new Error(uploadError.message || "Upload to Supabase storage failed");
  }

  const { data } = supabase.storage.from("call-recordings").getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Unable to retrieve public URL from Supabase storage");
  }

  return data.publicUrl;
}
