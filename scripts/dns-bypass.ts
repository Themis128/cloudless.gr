import https from "https";
import type { IncomingMessage } from "http";

const IP_OVERRIDES: Record<string, string> = {
  "ads-api.x.com": "172.66.0.227",
  "business-api.tiktok.com": "2.21.69.8",
  "ads.tiktok.com": "2.16.19.9",
  "www.tiktok.com": "2.21.69.9",
  "ads.google.com": "142.251.142.110",
  "googleads.googleapis.com": "172.217.171.74",
};

type FetchLike = { status: number; json(): Promise<unknown> };

export async function bypassFetch(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<FetchLike> {
  const { hostname, pathname, search } = new URL(url);
  const ip = IP_OVERRIDES[hostname];

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: ip ?? hostname,   // connect to IP directly — no DNS needed
        port: 443,
        path: pathname + search,
        method: opts.method ?? "GET",
        headers: { ...opts.headers, Host: hostname },
        servername: hostname,   // SNI so TLS cert validates correctly
      },
      (res: IncomingMessage) => {
        let raw = "";
        res.on("data", (c: Buffer) => { raw += c; });
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, json: () => Promise.resolve(JSON.parse(raw)) })
        );
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
