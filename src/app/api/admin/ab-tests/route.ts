import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getABFlags, DEFAULT_FLAGS, type ABFlag } from "@/lib/ab-flags";
import SSM from "@aws-sdk/client-ssm";

const SSM_KEY = "/cloudless/AB_FLAGS_JSON";

async function putSSMParam(value: string): Promise<void> {
  const region = process.env.AWS_REGION ?? "eu-central-1";
  const client = new SSM.SSMClient({ region });
  await client.send(
    new SSM.PutParameterCommand({
      Name: SSM_KEY,
      Value: value,
      Type: "String",
      Overwrite: true,
    }),
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const flags = await getABFlags();
  return NextResponse.json({ flags });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let updates: Partial<ABFlag> & { id: string };
  try {
    updates = await request.json();
    if (!updates.id) throw new Error("id required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 },
    );
  }

  const flags = await getABFlags();
  const idx = flags.findIndex((f) => f.id === updates.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  }

  flags[idx] = { ...flags[idx], ...updates, id: flags[idx].id };

  try {
    await putSSMParam(JSON.stringify(flags));
  } catch {
    // SSM not available in dev — return updated flags anyway
    return NextResponse.json({
      flags,
      warning: "SSM unavailable — changes not persisted",
    });
  }

  return NextResponse.json({ flags });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { action: "reset" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (body.action === "reset") {
    try {
      await putSSMParam(JSON.stringify(DEFAULT_FLAGS));
    } catch {
      return NextResponse.json({
        flags: DEFAULT_FLAGS,
        warning: "SSM unavailable — changes not persisted",
      });
    }
    return NextResponse.json({ flags: DEFAULT_FLAGS });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
