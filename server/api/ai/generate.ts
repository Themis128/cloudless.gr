// File: src/app/api/ai/generate/route.ts
// Next.js API Route for Cloudflare Workers AI Integration

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs' // Required for fetch in Lambda

interface GenerateRequest {
  prompt: string
  model?: string
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = '@cf/meta/llama-3-8b-instruct' } = (await request.json()) as GenerateRequest

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Cloudflare credentials not configured' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: `Cloudflare API error: ${data.errors?.[0]?.message || 'Unknown error'}` },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      result: data.result?.response,
      model,
      usage: {
        inputTokens: data.result?.input_tokens || 0,
        outputTokens: data.result?.output_tokens || 0
      }
    })
  } catch (error) {
    console.error('Workers AI error:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    )
  }
}
