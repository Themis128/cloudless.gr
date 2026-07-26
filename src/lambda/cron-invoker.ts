import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export async function handler() {
  const siteUrl = process.env.SITE_URL;
  const ssmPrefix = process.env.SSM_PREFIX ?? "/cloudless/production";
  const route = process.env.CRON_ROUTE;

  if (!siteUrl || !route) {
    throw new Error(`Missing env: SITE_URL=${siteUrl}, CRON_ROUTE=${route}`);
  }

  const { Parameter } = await ssm.send(
    new GetParameterCommand({
      Name: `${ssmPrefix}/CRON_SECRET`,
      WithDecryption: true,
    })
  );
  const secret = Parameter?.Value;
  if (!secret) throw new Error(`CRON_SECRET not found at ${ssmPrefix}/CRON_SECRET`);

  const res = await fetch(`${siteUrl}${route}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cron ${route} responded ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = await res.json().catch(() => null);
  return { statusCode: res.status, route, payload };
}
