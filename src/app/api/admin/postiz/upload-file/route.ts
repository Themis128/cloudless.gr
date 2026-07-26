import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  POSTIZ_ALLOWED_UPLOAD_MIME,
  PostizApiError,
  PostizNotConfiguredError,
  uploadFile,
} from "@/lib/postiz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/postiz/upload-file — multipart pass-through to Postiz.
 *
 * Body: multipart/form-data with a `file` field (the binary blob) and an
 * optional `filename` field. Use this when the source is a local file the
 * user picked; `/upload` already handles URL-sourced media.
 */
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — matches Postiz upstream default.

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

  // Fail fast on disallowed MIME types so the user gets a clean 4xx instead
  // of waiting on a round-trip to Postiz that ends in a content-sniff 400.
  // The Postiz allowlist is jpeg/png/gif/webp/avif/bmp/tiff/mp4 (no PDFs,
  // no svg, no audio). A blank/absent `file.type` falls through — let
  // Postiz make the call.
  if (file.type && !POSTIZ_ALLOWED_UPLOAD_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: "unsupported_mime",
        mime: file.type,
        allowed: [...POSTIZ_ALLOWED_UPLOAD_MIME],
      },
      { status: 415 }
    );
  }

  try {
    const uploaded = await uploadFile(file, filename);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 404 });
    }
    if (err instanceof PostizApiError) {
      return NextResponse.json(
        { error: "postiz_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    throw err;
  }
}
