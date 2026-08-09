/**
 * POST /api/admin/headlamp/token — mint a short-lived (24h) k8s
 * ServiceAccount JWT for the `headlamp-admin` SA, so the admin can paste
 * it into the Headlamp login page at https://manage.cloudless.gr.
 *
 * Auth: requireAdmin (D1 session cookie or Bearer). RBAC on the k8s side:
 * infrastructure/headlamp/token-minter-rbac.yaml grants the cloudless
 * pod's default SA `create` on `serviceaccounts/token` for headlamp-admin
 * ONLY (no other SA, no other verb).
 *
 * Response: { token, expirationTimestamp }.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isInCluster, k8sPost } from "@/lib/k8s-cluster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TokenRequestStatus {
  status?: { token?: string; expirationTimestamp?: string };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isInCluster()) {
    return NextResponse.json(
      { error: "Not running inside the cluster (dev / local). Token minting only works in-pod." },
      { status: 503 }
    );
  }

  const result = await k8sPost<unknown, TokenRequestStatus>(
    "/api/v1/namespaces/headlamp/serviceaccounts/headlamp-admin/token",
    {
      apiVersion: "authentication.k8s.io/v1",
      kind: "TokenRequest",
      spec: {
        expirationSeconds: 86400, // 24h — max reasonable for a browser session
        audiences: [], // default to apiserver audience so Headlamp accepts it
      },
    }
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: `TokenRequest failed (${result.status}): ${result.error}` },
      { status: result.status === 501 ? 501 : 502 }
    );
  }

  const token = result.data.status?.token;
  const expiresAt = result.data.status?.expirationTimestamp;
  if (!token) {
    return NextResponse.json(
      { error: "TokenRequest returned no token" },
      { status: 502 }
    );
  }

  return NextResponse.json({ token, expirationTimestamp: expiresAt });
}
