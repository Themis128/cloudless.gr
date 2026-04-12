import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const ICON_MAP: Record<string, string> = {
  "icon-192.png": "android-chrome-192x192.png",
  "icon-512.png": "android-chrome-512x512.png",
  "icon-512-maskable.png": "android-chrome-512x512.png",
};

// 1x1 transparent PNG fallback to avoid broken PWA icon requests in local copies
// that don't include the brand/favicons directory.
const FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0mQAAAAASUVORK5CYII=";

function fallbackPngResponse() {
  return new NextResponse(Buffer.from(FALLBACK_PNG_BASE64, "base64"), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function readFirstExisting(filePaths: string[]) {
  for (const filePath of filePaths) {
    try {
      return await readFile(fileP