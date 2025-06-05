import { defineEventHandler, readBody, setHeader } from 'h3';
import fetch from 'node-fetch';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phind-codellama:34b';

export const config = {
  bodyParser: {
    json: { limit: '4mb' },
  },
};

export default defineEventHandler(async (event) => {
  setHeader(event, 'x-content-type-options', 'nosniff');
  setHeader(event, 'cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (event.method !== 'POST') {
    setHeader(event, 'content-type', 'application/json; charset=utf-8');
    event.node.res.statusCode = 405;
    event.node.res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body;
  try {
    body = await readBody(event);  } catch (e) {
    console.error('JSON parsing error:', e);
    setHeader(event, 'content-type', 'application/json; charset=utf-8');
    event.node.res.statusCode = 400;
    event.node.res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  if (!body || typeof body.prompt !== 'string') {
    setHeader(event, 'content-type', 'application/json; charset=utf-8');
    event.node.res.statusCode = 400;
    event.node.res.end(JSON.stringify({ error: 'Missing or invalid prompt' }));
    return;
  }

  if (body.prompt.length > 32000) {
    setHeader(event, 'content-type', 'application/json; charset=utf-8');
    event.node.res.statusCode = 413;
    event.node.res.end(JSON.stringify({ error: 'Prompt too long' }));
    return;
  }

  // Streaming with AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: body.prompt,
        model: body.model || OLLAMA_MODEL,
        stream: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok || !response.body) {
      setHeader(event, 'content-type', 'application/json; charset=utf-8');
      event.node.res.statusCode = response.status;
      let errorText = await response.text();
      try {
        const errJson = JSON.parse(errorText);
        errorText = errJson.error || errorText;
      } catch {
        // Intentionally empty - if JSON parsing fails, use errorText as-is
      }
      event.node.res.end(JSON.stringify({ error: `Ollama server error: ${errorText}` }));
      return;
    }
    setHeader(event, 'content-type', 'text/event-stream; charset=utf-8');
    // Forward the stream as text/event-stream, ensure each chunk is a string
    for await (const chunk of response.body) {
      // Convert Buffer or Uint8Array to string
      let strChunk;
      if (Buffer.isBuffer(chunk)) {
        strChunk = chunk.toString('utf8');
      } else if (Object.prototype.toString.call(chunk) === '[object Uint8Array]') {
        strChunk = Buffer.from(chunk).toString('utf8');
      } else {
        strChunk = String(chunk);
      }
      event.node.res.write(strChunk);
    }
    event.node.res.end();
  } catch (err) {
    clearTimeout(timeout);
    setHeader(event, 'content-type', 'application/json; charset=utf-8');
    // Improved error logging for debugging
    if (err instanceof Error) {
       
      console.error('LLM API error:', err.message, err.stack);
    } else {
       
      console.error('LLM API error:', err);
    }
    if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'AbortError') {
      event.node.res.statusCode = 504;
      event.node.res.end(JSON.stringify({ error: 'Ollama server timeout' }));
      return;
    }
    event.node.res.statusCode = 502;
    event.node.res.end(JSON.stringify({ error: 'Failed to connect to Ollama server' }));
  }
});
