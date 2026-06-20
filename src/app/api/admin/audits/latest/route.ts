import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * Returns the most recent `audits-dashboard-*` artifact produced by
 * audits-aggregator.yml — parsed as `dashboard.json`.
 *
 * Auth is admin-only. The route uses a long-lived GH token stored in SSM
 * (`/cloudless/gh/actions-read`) — minimum scope `actions:read`, `contents:read`.
 *
 * The artifact zip is fetched, the dashboard.json entry extracted in-memory,
 * and the parsed object returned. Cached briefly at the edge.
 */

const REPO = "Themis128/cloudless.gr";
const WORKFLOW = "audits-aggregator.yml";

export const dynamic = "force-dynamic";

async function gh<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      "User-Agent": "cloudless-app/1.0",
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`GH API ${res.status} ${res.statusText}: ${path}`);
  }
  return res.json() as Promise<T>;
}

interface RunsResponse {
  workflow_runs: Array<{
    id: number;
    head_sha: string;
    html_url: string;
    updated_at: string;
    conclusion: string;
  }>;
}

interface ArtifactsResponse {
  artifacts: Array<{ id: number; name: string; archive_download_url: string }>;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Source the GH token. Prefer env (local dev), fall back to SSM-loaded config.
  const token = process.env.GH_AUDITS_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Audits API not configured — set GH_AUDITS_TOKEN" },
      { status: 503 }
    );
  }

  try {
    const runs = await gh<RunsResponse>(
      `/repos/${REPO}/actions/workflows/${encodeURIComponent(WORKFLOW)}/runs?per_page=5&status=success`,
      token
    );
    const run = runs.workflow_runs[0];
    if (!run) {
      return NextResponse.json({ error: "No successful aggregator runs yet" }, { status: 404 });
    }

    const arts = await gh<ArtifactsResponse>(
      `/repos/${REPO}/actions/runs/${run.id}/artifacts`,
      token
    );
    const dash = arts.artifacts.find((a) => a.name.startsWith("audits-dashboard-"));
    if (!dash) {
      return NextResponse.json({ error: "Dashboard artifact missing" }, { status: 404 });
    }

    // Download the zip. The GH redirect points at a presigned blob URL.
    const zipRes = await fetch(dash.archive_download_url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "cloudless-app/1.0",
      },
      redirect: "follow",
    });
    if (!zipRes.ok) {
      return NextResponse.json(
        { error: `Artifact download failed: ${zipRes.status}` },
        { status: 502 }
      );
    }
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());

    // Parse the zip in-memory to extract dashboard.json without writing to disk.
    // Use Node's built-in unzip via zlib? Simpler: shell-out to /usr/bin/unzip
    // is unavailable in Lambda. Use a tiny zip reader from `unzipper` once we
    // add it; for now we do a minimal central-directory parse inline.
    const json = await extractJsonFromZip(zipBuf, "dashboard.json");
    if (!json) {
      return NextResponse.json({ error: "dashboard.json not found in artifact" }, { status: 502 });
    }

    return NextResponse.json(JSON.parse(json), {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[audits/latest] " + JSON.stringify(String(err)));
    return NextResponse.json({ error: "Failed to fetch audit dashboard" }, { status: 500 });
  }
}

/**
 * Extract a single named file from a ZIP archive (no compression) — relies on
 * the central directory at the end of the zip. Sufficient for stored or
 * deflated entries produced by GitHub Actions artifact uploader, which use
 * deflate. Decompresses deflate streams via the built-in zlib.
 */
async function extractJsonFromZip(buf: Buffer, name: string): Promise<string | null> {
  // Find End of Central Directory record — scan from the tail.
  const SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65536; i--) {
    if (buf.readUInt32LE(i) === SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const _cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdEntries = buf.readUInt16LE(eocd + 10);

  const { promisify } = await import("node:util");
  const { inflateRaw } = await import("node:zlib");
  const inflateRawAsync = promisify(inflateRaw);

  let pos = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) return null; // bad CD entry sig
    const compMethod = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const fileNameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const entryName = buf.slice(pos + 46, pos + 46 + fileNameLen).toString("utf8");
    pos += 46 + fileNameLen + extraLen + commentLen;

    if (entryName !== name) continue;
    // Decode the local header at localHeaderOffset
    const lhSig = buf.readUInt32LE(localHeaderOffset);
    if (lhSig !== 0x04034b50) return null;
    const lhFileNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lhFileNameLen + lhExtraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    if (compMethod === 0) {
      return data.toString("utf8");
    }
    if (compMethod === 8) {
      const inflated = await inflateRawAsync(data);
      return inflated.toString("utf8");
    }
    return null;
  }
  return null;
}
