import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { callClaude, getAnthropicApiKey } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let description: string;
  let platforms: string[];
  let objective: string;
  try {
    const body = await request.json();
    description = body.description;
    platforms = Array.isArray(body.platforms)
      ? body.platforms
      : ["Meta", "LinkedIn", "Google"];
    objective = body.objective ?? "LEAD_GENERATION";
    if (!description) throw new Error("description is required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 },
    );
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured." },
      { status: 503 },
    );
  }

  const prompt = `You are a digital marketing targeting expert for Cloudless.gr, a Greek digital agency specialising in AI-powered marketing.

Given this target customer description, generate detailed audience targeting parameters for each requested platform.

Customer description: ${description}
Campaign objective: ${objective}
Platforms: ${platforms.join(", ")}

Respond with a JSON object (no markdown fences, just raw JSON) with this structure:
{
  "summary": "one paragraph description of the ideal customer",
  "demographics": {
    "age_range": "e.g. 28-45",
    "gender": "All | Male | Female",
    "locations": ["primary geo targets"],
    "languages": ["language codes"]
  },
  "platforms": {
    "Meta": {
      "interests": ["list of interest categories"],
      "behaviors": ["list of behaviors"],
      "lookalike_source": "description of ideal lookalike seed audience",
      "exclusions": ["audiences to exclude"]
    },
    "LinkedIn": {
      "job_titles": ["list of job titles"],
      "industries": ["list of industries"],
      "company_size": "e.g. 1-200 employees",
      "seniority": ["list of seniority levels"]
    },
    "Google": {
      "in_market_segments": ["list of in-market audience segments"],
      "keywords": ["list of search keywords"],
      "placements": ["recommended site placements"],
      "topics": ["content topics"]
    },
    "TikTok": {
      "interest_categories": ["list of TikTok interest categories"],
      "behaviors": ["list of behaviors"],
      "hashtags": ["relevant hashtags"]
    },
    "X": {
      "follower_lookalikes": ["accounts whose followers to target"],
      "interests": ["interest categories"],
      "keywords": ["keyword targets"]
    }
  },
  "estimated_audience_size": {
    "Meta": "e.g. 150,000 - 400,000",
    "LinkedIn": "e.g. 20,000 - 50,000",
    "Google": "e.g. broad reach"
  }
}

Only include the platforms that were requested. Tailor recommendations for the Greek market unless the description specifies otherwise.`;

  try {
    const text = await callClaude(prompt, apiKey, { maxTokens: 1_500 });
    let targeting: unknown;
    try {
      targeting = JSON.parse(text.replaceAll(/```json\n?|\n?```/g, "").trim());
    } catch {
      targeting = { raw: text };
    }
    return NextResponse.json({ targeting });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed." },
      { status: 500 },
    );
  }
}
