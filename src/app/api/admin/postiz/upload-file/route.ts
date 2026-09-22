import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  saErrorToResponse,
  uploadFileToSocialAuto,
} from "@/lib/socialauto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/postiz/upload-file — multipart pass-through to SocialAuto
 * `/media/upload`.
 *
 * Body: multipart/form-data with a `file` field (the binary blob) and an
 * optional `filename` field. Use this when the source is a local file the
 * user picked; `/upload` already handles URL-sourced media.
 */
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — keep the previous page-side cap.

/** SocialAuto `/media/upload` extension allowlist, expressed as MIME types
 *  for early rejection: images, video, and audio. */
const SA_ALLOWED_UPLOAD_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
  "audio/mp4",
  "audio/ogg",
  "audio/flac",
]);

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", maxBytes: MAX_FILE_BYTES, actualBytes: file.size },
      { status: 413 }
    );
  }

  const filename =
    (form.get("filename") as string | null) ?? (file instanceof File ? file.name : "upload.bin");

  // Validate filename for path traversal
  if (/(\.\.|\\|\/)/.test(filename)) {
    return NextResponse.json({ error: "invalid_filename" }, { status: 400 });
  }

  // Fail fast on disallowed MIME types so the user gets a clean 4xx instead
  // of waiting on a round-trip to SocialAuto that ends in a 400. A
  // blank/absent `file.type` falls through — the extension check upstream
  // makes the final call.
  if (file.type && !SA_ALLOWED_UPLOAD_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: "unsupported_mime",
        mime: file.type,
        allowed: [...SA_ALLOWED_UPLOAD_MIME],
      },
      { status: 415 }
    );
  }

  try {
    const uploaded = await uploadFileToSocialAuto(file, filename);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (err) {
    return saErrorToResponse(err);
  }
}
