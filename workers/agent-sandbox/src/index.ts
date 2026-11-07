interface Env {
  LOADER: WorkerLoader;
  SANDBOX_TOKEN?: string;
}

// Allow-listed modules only — arbitrary user code is never loaded.
const MODULES: Record<string, string> = {
  "lead-score": `export default { async fetch(req) {
    const { form = "", answers = {} } = await req.json();
    let s = 40;
    if (form === "audit-request") s += 30;
    if (form === "newsletter") s += 10;
    if (answers.timeline === "now") s += 20; else if (answers.timeline === "quarter") s += 10;
    if ((answers.pain || "").length > 40) s += 10;
    return Response.json({ score: Math.min(s, 100) });
  }}`,
  "template-fill": `export default { async fetch(req) {
    const { template = "", vars = {} } = await req.json();
    const out = template.replace(/\\{(\\w+)\\}/g, (_, k) => String(vars[k] ?? "{" + k + "}"));
    return Response.json({ out });
  }}`,
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health")
      return Response.json({ ok: true, modules: Object.keys(MODULES) });
    const token = req.headers.get("Authorization") ?? "";
    if (!env.SANDBOX_TOKEN || token !== `Bearer ${env.SANDBOX_TOKEN}`)
      return Response.json({ error: "unauthorized" }, { status: 401 });
    if (url.pathname !== "/run" || req.method !== "POST")
      return Response.json({ error: "unknown" }, { status: 404 });
    const { module: mod, input } = await req.json<{ module: string; input?: unknown }>();
    const source = MODULES[mod];
    if (!source)
      return Response.json(
        { error: `module must be one of: ${Object.keys(MODULES).join(", ")}` },
        { status: 400 }
      );
    // Binding-less worker — no env, no bindings, fetch-only sandbox.
    const worker = env.LOADER.get(mod, () => ({
      compatibilityDate: "2026-11-01",
      mainModule: "index.js",
      modules: { "index.js": source },
    }));
    const res = await worker
      .getEntrypoint()
      .fetch(
        new Request("https://sandbox/run", { method: "POST", body: JSON.stringify(input ?? {}) })
      );
    return new Response(res.body, res);
  },
};
