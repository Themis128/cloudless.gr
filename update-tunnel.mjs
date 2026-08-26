import Cloudflare from 'cloudflare';

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const TUNNEL_ID = process.env.CLOUDFLARE_TUNNEL_ID ?? "e977a490-58c5-4fdb-9155-86832e3e636a";

if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
  console.error("Missing required env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

const client = new Cloudflare({
  apiToken: CF_API_TOKEN,
});

async function updateTunnelConfig() {
  try {
    // Get current config first
    const currentConfig = await client.zeroTrust.tunnels.configurations.get(TUNNEL_ID, {
      account_id: CF_ACCOUNT_ID,
    });
    console.log("Current config retrieved");
    console.log(JSON.stringify(currentConfig, null, 2));
  } catch (error) {
    console.error("Get config error:", error.message);
  }

  try {
    // Update the config - point cloudless.gr to k3s NodePort 30300
    const result = await client.zeroTrust.tunnels.configurations.update(TUNNEL_ID, {
      account_id: CF_ACCOUNT_ID,
      config: {
        ingress: [
          { hostname: "webmail.cloudless.gr", service: "http://192.168.1.130:80", originRequest: { connectTimeout: "15s" } },
          { hostname: "cloudless.gr", service: "http://192.168.1.128:30300", originRequest: { noTLSVerify: true, connectTimeout: "30s" } },
          { hostname: "manage.cloudless.gr", service: "http://localhost:80", originRequest: { noTLSVerify: true, connectTimeout: "30s" } },
          { hostname: "pi-origin.cloudless.gr", service: "http://localhost:80", originRequest: { connectTimeout: "30s", httpHostHeader: "pi-origin.cloudless.gr" } },
          { hostname: "grafana.cloudless.gr", service: "http://192.168.1.128:30850", originRequest: { noTLSVerify: true, connectTimeout: "15s", tcpKeepAlive: "30s" } },
          { hostname: "postiz.cloudless.gr", service: "http://192.168.1.128:30500", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s" } },
          { hostname: "espocrm.cloudless.gr", service: "http://192.168.1.128:30700", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s" } },
          { hostname: "appflowy.cloudless.gr", service: "http://192.168.1.128:30810", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s", noTLSVerify: false, httpHostHeader: "appflowy.cloudless.gr" } },
          { hostname: "n8n.cloudless.gr", service: "http://192.168.1.128:30900", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s", httpHostHeader: "n8n.cloudless.gr" } },
          { hostname: "kuma.cloudless.gr", service: "http://192.168.1.128:32501", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s", noTLSVerify: false, httpHostHeader: "kuma.cloudless.gr" } },
          { hostname: "ntfy.cloudless.gr", service: "http://192.168.1.128:30080", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s", httpHostHeader: "ntfy.cloudless.gr" } },
          { hostname: "omv.cloudless.gr", service: "http://localhost:80", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s", httpHostHeader: "omv.cloudless.gr" } },
          { hostname: "ftp.cloudless.gr", service: "http://localhost:21", originRequest: { connectTimeout: "30s", tcpKeepAlive: "60s" } },
          { hostname: "docs.cloudless.gr", service: "http://192.168.1.128:30901", originRequest: { connectTimeout: "15s", tcpKeepAlive: "30s" } },
          { hostname: "meili.cloudless.gr", service: "http://192.168.1.128:30902", originRequest: { connectTimeout: "10s", tcpKeepAlive: "30s" } },
          { hostname: "agent.cloudless.gr", service: "http://192.168.1.128:30924", originRequest: { connectTimeout: "30s", tcpKeepAlive: "30s", httpHostHeader: "agent.cloudless.gr" } },
          { hostname: "vibe.cloudless.gr", service: "http://192.168.1.128:30301", originRequest: { connectTimeout: "30s", tcpKeepAlive: "30s", httpHostHeader: "vibe.cloudless.gr" } },
          { hostname: "logs.cloudless.gr", service: "http://192.168.1.128:30820", originRequest: { connectTimeout: "10s", tcpKeepAlive: "30s", keepAliveConnections: 10, keepAliveTimeout: "90s" } },
          { service: "http_status:404" }
        ]
      }
    });
    
    console.log("✅ Tunnel config updated successfully!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Update error:", error.message);
    if (error.errors) console.error(JSON.stringify(error.errors, null, 2));
  }
}

updateTunnelConfig();
