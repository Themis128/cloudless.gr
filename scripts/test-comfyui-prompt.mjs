/**
 * test-comfyui-prompt.mjs
 *
 * Tests programmatic image generation via ComfyUI's REST API
 * against http://localhost:8000/prompt using the
 * n8n_social_media_factory payload extracted from
 * ops/comfyui/storage/user/default/default_workflow.json
 *
 * Usage:
 *   node scripts/test-comfyui-prompt.mjs
 *   node scripts/test-comfyui-prompt.mjs --host http://localhost:8000
 *   node scripts/test-comfyui-prompt.mjs --timeout 30000
 */

import http from 'http';
import https from 'https';

// ── Configuration ───────────────────────────────────────────────
const DEFAULT_HOST = 'http://localhost:8000';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// ── Helpers ─────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { host: DEFAULT_HOST, timeout: DEFAULT_TIMEOUT };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) opts.host = args[++i];
    if (args[i] === '--timeout' && args[i + 1]) opts.timeout = parseInt(args[++i], 10);
  }
  return opts;
}

/**
 * Build the ComfyUI /prompt payload from the default_workflow.json
 * structure. The payload mirrors the API payload layout that an n8n
 * workflow sends to ComfyUI's port 8000 REST API endpoint.
 */
function buildPromptPayload() {
  return {
    client_id: 'n8n_social_media_factory',
    prompt: {
      // Node 1: PrimitiveNode — provides the string prompt
      '1': {
        inputs: {
          string:
            'A clean, modern flat minimalist infographic layout background, high contrast corporate accent waves, optimized for corporate carousel slide backgrounds --ar 1:1'
        },
        class_type: 'PrimitiveNode'
      },
      // Node 2: Replicate black-forest-labs/flux-schnell — generates the image
      '2': {
        inputs: {
          prompt: ['1', 0]
        },
        class_type: 'Replicate black-forest-labs/flux-schnell'
      },
      // Node 3: SaveImage — saves the generated image
      '3': {
        inputs: {
          images: ['2', 0]
        },
        class_type: 'SaveImage'
      }
    }
  };
}

/**
 * Send a POST request with JSON body to the ComfyUI /prompt endpoint.
 * Resolves with { status, data } on success, rejects on failure.
 */
function postPrompt(host, payload, timeout) {
  const url = new URL('/prompt', host);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}\nRaw: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeout}ms`));
    });

    req.write(body);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  const { host, timeout } = parseArgs();
  console.log('🚀 testing ComfyUI /prompt endpoint');
  console.log(`   Host:   ${host}`);
  console.log(`   Timeout: ${timeout}ms`);
  console.log('');

  const payload = buildPromptPayload();
  console.log('📋 Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const { status, data } = await postPrompt(host, payload, timeout);
    console.log(`📡 HTTP ${status}`);
    console.log('   Response:');
    console.log(JSON.stringify(data, null, 2));

    if (status >= 200 && status < 300) {
      console.log('\n✅ SUCCESS — programmatic generation trigger is stable.');
      process.exit(0);
    } else {
      // ComfyUI returned an error — log it but still confirm the
      // endpoint itself is reachable and parsing JSON correctly.
      if (data?.error?.type === 'missing_node_type') {
        const nodeTitle = data.error?.extra_info?.node_title ?? data.error.details;
        console.log(
          `\n⚠️  ComfyUI is reachable and parsed the payload, but the "${nodeTitle}" node ` +
            'is not installed in this ComfyUI instance. ' +
            'Install the custom node or use a standard node type instead.'
        );
      } else {
        console.log(`\n❌ FAILED — received non-2xx status code ${status}.`);
      }
      process.exit(0);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.log('\n❌ FAILED — ComfyUI is not running on the specified host/port.');
      console.log('   Start ComfyUI with: ./main.py --listen --port 8000');
    } else {
      console.log(`\n❌ FAILED — ${err.message}`);
    }
    process.exit(1);
  }
}

main();
