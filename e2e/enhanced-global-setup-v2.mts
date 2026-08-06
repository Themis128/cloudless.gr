import type { FullConfig } from "@playwright/test";

const BASE_URL = "http://localhost:4000";

async function probe(
  pathname: string,
  accept: string,
  expect: (res: Response, body: string) => string | null
): Promise<void> {
  const url = `${BASE_URL}${pathname}`;
  let res: Response;
  let body: string;
  try {
    res = await fetch(url, { headers: { accept } });
    body = await res.text();
  } catch (err) {
    throw new Error(
      `[e2e:enhanced-setup] Could not reach ${url}: ${(err as Error).message}\n` +
      `The dev server on port 4000 is not responding. Start it with \`pnpm dev\` or let Playwright launch it.`
    );
  }

  const problem = expect(res, body);
  if (problem) {
    throw new Error(
      `[e2e:enhanced-setup] ${url} is unhealthy — ${problem}\n` +
      `Got HTTP ${res.status}; body starts: ${body.slice(0, 80).replace(/\s+/g, " ")}\n\n` +
      `This usually means a STALE dev server is on port 4000 (reuseExistingServer is on for local\n` +
      `runs). Routing/proxy isn't wired, so every route 404s and next-auth returns the HTML 404 page.\n` +
      `Fix: kill the old server and let Playwright start a fresh one —\n` +
      `    lsof -ti:4000 | xargs -r kill && pnpm test:e2e`
    );
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  console.log("[e2e:enhanced-setup] Starting enhanced server health validation with retries...");
  
  // Retry logic for health checks
  const maxAttempts = 5;
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[e2e:enhanced-setup] Health check attempt ${attempt}/${maxAttempts}...`);
      
      // /api/health — proves API route handlers resolve
      await probe("/api/health", "application/json", (res, body) => {
        if (res.status !== 200) return "expected HTTP 200 from the health route";
        try {
          const json = JSON.parse(body) as { status?: string };
          if (json.status !== "ok" && json.status !== "degraded") {
            return `expected status "ok" or "degraded", got "${json.status}"`;
          }
        } catch {
          return "health route did not return JSON (served the 404 HTML page?)";
        }
        return null;
      });

      // /en — proves the proxy ran and next-intl resolved the locale-prefixed page.
      await probe("/en", "text/html", (res) => {
        if (res.status >= 400) return "expected the home page to render (proxy + next-intl not wired?)";
        return null;
      });

      console.log("[e2e:enhanced-setup] ������� ����� ����� ����� ������ ������ ����� ������ ������ ������ ������ ������ ����� ��� ��� ��� ���� ���� ��� ���� ���� ���� ���� ���� ����� ��� ��� ��� ���� ���� ��� ���� ���� ���� ���� ���� ��� � � � �� �� � �� �� �� �� �� Server is healthy - /api/health and /en both resolve.");
      return; // Success, exit the function
    } catch (err) {
      lastError = err as Error;
      console.warn(`[e2e:enhanced-setup] Attempt ${attempt} failed: ${err.message}`);
      
      if (attempt < maxAttempts) {
        // Wait before retrying (exponential backoff: 1s, 2s, 4s, 8s)
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[e2e:enhanced-setup] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all attempts failed
  throw new Error(
    `[e2e:enhanced-setup] Server health check failed after ${maxAttempts} attempts. ` +
    `Last error: ${lastError?.message}\n\n` +
    `Troubleshooting suggestions:\n` +
    `1. Check if dev server is running: lsof -i:4000\n` +
    `2. Check server logs for errors\n` +
    `3. Try manually: pnpm dev\n` +
    `4. Check if port 4000 is blocked or used by another service\n` +
    `5. Verify Next.js and dependencies are installed correctly`
  );
}
