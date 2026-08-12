"use client";

/**
 * /admin/headlamp — one-click helper for logging into the self-hosted
 * Headlamp Kubernetes UI at https://manage.cloudless.gr.
 *
 * Why: Headlamp v0.36 UI always prompts for a token even when the backend
 * is in-cluster + authenticated (see docs/HEADLAMP.md for the honest write-
 * up). This page mints a fresh 24h k8s SA JWT via /api/admin/headlamp/token,
 * copies it to the clipboard, and opens Headlamp in a new tab so the user
 * just Ctrl+V-s into the login field.
 */
import { useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const HEADLAMP_URL = "https://manage.cloudless.gr";

interface TokenResponse {
  token: string;
  expirationTimestamp: string;
}

export default function HeadlampHelperPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [token, setToken] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function mint(openTab: boolean) {
    setStatus("loading");
    setError("");
    try {
      const res = await fetchWithAuth("/api/admin/headlamp/token", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as TokenResponse;
      setToken(data.token);
      setExpiresAt(data.expirationTimestamp);
      // Copy to clipboard best-effort — silent-ok if permission denied
      try {
        await navigator.clipboard.writeText(data.token);
      } catch {
        /* user can still copy manually from the textarea below */
      }
      setStatus("ready");
      if (openTab) {
        window.open(HEADLAMP_URL, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Headlamp — cluster admin UI</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Headlamp lives at{" "}
          <a
            href={HEADLAMP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {HEADLAMP_URL}
          </a>
          . Its login page asks for a k8s ServiceAccount token. Click below and it&apos;s copied to
          your clipboard + Headlamp opens in a new tab — paste (Ctrl+V) into the &quot;ID
          token&quot; field and you&apos;re in. Token is valid for 24h.
        </p>
      </header>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => mint(true)}
          disabled={status === "loading"}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {status === "loading" ? "Minting…" : "Get token & open Headlamp"}
        </button>
        <button
          type="button"
          onClick={() => mint(false)}
          disabled={status === "loading"}
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Just copy token (don&apos;t open)
        </button>
      </div>

      {status === "ready" && (
        <div className="space-y-3 rounded-lg border border-green-300 bg-green-50 p-4 text-sm dark:border-green-800 dark:bg-green-950">
          <p className="font-medium text-green-800 dark:text-green-200">
            ✅ Token copied to clipboard. Expires{" "}
            {new Date(expiresAt).toLocaleString(undefined, { timeZone: "Europe/Athens" })}.
          </p>
          <details>
            <summary className="cursor-pointer text-green-900 dark:text-green-100">
              Show raw token (fallback if clipboard didn&apos;t work)
            </summary>
            <textarea
              readOnly
              value={token}
              rows={4}
              className="mt-2 w-full rounded border border-green-300 bg-white p-2 font-mono text-xs dark:border-green-700 dark:bg-neutral-900"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </details>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-950">
          <p className="font-medium text-red-800 dark:text-red-200">❌ {error}</p>
          <p className="mt-2 text-xs text-red-700 dark:text-red-300">
            Likely causes: the /api/admin/headlamp/token endpoint isn&apos;t deployed yet, the pod
            isn&apos;t running in-cluster (dev mode?), or the RBAC in{" "}
            <code>infrastructure/headlamp/token-minter-rbac.yaml</code> hasn&apos;t been applied.
          </p>
        </div>
      )}
    </div>
  );
}
