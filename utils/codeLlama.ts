// Utility to call local LLM API endpoint via Nuxt server route

import fetch from "node-fetch";

export async function generateCode(prompt: string): Promise<string> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error("Failed to call local LLM API");
  }

  const data: any = await response.json();
  // Ollama and similar LLM APIs often return the result in data.response or data.generated_text
  return (
    data.response || data.generated_text || data.result || JSON.stringify(data)
  );
}
