// Utility to call local LLM API endpoint via Nuxt server route

/**
 * Calls the LLM API endpoint and streams the response as text/code only.
 * @param prompt The prompt to send to the LLM.
 * @param onData Optional callback for streaming chunks of text/code.
 * @param endpoint Optional override for the LLM API endpoint (default: from env or /api/generate)
 * @returns The full LLM response as a string.
 * @throws Error if the API call fails or returns an error.
 */
export async function generateLLMResponse(
  prompt: string,
  onData?: (chunk: string) => void,
  endpoint?: string
): Promise<string> {
  // Use endpoint argument, then env, then fallback
  const apiEndpoint =
    endpoint ||
    (typeof process !== "undefined" && process.env.LLM_API_URL) ||
    "/api/generate";
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    // Try to parse error from JSON or text
    let errMsg = `Failed to call local LLM API (${response.status})`;
    try {
      const err = await response.json();
      errMsg = err.error || errMsg;
    } catch {
      try {
        errMsg = await response.text();
      } catch {}
    }
    throw new Error(errMsg);
  }

  // Streaming mode
  if (response.body && onData) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = "";
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        // Extract complete JSON objects from buffer
        let boundary;
        while ((boundary = buffer.indexOf("}\n{")) !== -1) {
          const jsonStr = buffer.slice(0, boundary + 1);
          buffer = buffer.slice(boundary + 2); // skip the newline
          try {
            const obj = JSON.parse(jsonStr);
            if (typeof obj.response === "string") {
              result += obj.response;
              onData(obj.response);
            }
          } catch (e) {
            // Malformed chunk, skip
          }
        }
        // Try to parse last complete JSON object
        try {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            const obj = JSON.parse(trimmed);
            if (typeof obj.response === "string") {
              result += obj.response;
              onData(obj.response);
            }
            buffer = "";
          }
        } catch {
          // Incomplete or malformed, wait for more data
        }
      }
    } catch (streamErr) {
      // Streaming error, propagate
      throw new Error(
        "Error while streaming LLM response: " +
          (streamErr instanceof Error ? streamErr.message : streamErr)
      );
    }
    return result;
  } else {
    // Non-streaming fallback
    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error("Failed to parse LLM response as JSON.");
    }
    return (
      (typeof data.response === "string" && data.response) ||
      (typeof data.generated_text === "string" && data.generated_text) ||
      (typeof data.result === "string" && data.result) ||
      "" // Never return JSON.stringify(data)
    );
  }
}
