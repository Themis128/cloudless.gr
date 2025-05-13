import { defineEventHandler, readBody } from "h3";
import fetch from "node-fetch";

export default defineEventHandler(async (event) => {
  event.node.res.setHeader("x-content-type-options", "nosniff");
  event.node.res.setHeader(
    "cache-control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  const body = await readBody(event);
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: body.prompt,
      model: "phind-codellama:34b",
      stream: false,
    }),
  });
  const data = await response.json();
  return data;
});
