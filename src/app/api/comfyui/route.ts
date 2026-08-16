import { NextResponse } from 'next/server';
import { normalizeAndValidatePrompt } from '@/lib/comfyui';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate and normalize the payload using our ComfyUI utilities
    const { client_id, prompt } = normalizeAndValidatePrompt(body);
    
    // Validate client_id format (optional, can be removed if not needed)
    const clientIdPattern = /^cloudless-factory-\d+$/;
    if (!clientIdPattern.test(client_id)) {
      return NextResponse.json(
        { error: 'Invalid client_id format' },
        { status: 400 }
      );
    }

    // If validation passes, forward to ComfyUI (WSL2 host:8000)
    // In production, this would be configured via environment variable
    const comfyUIEndpoint = process.env.COMFYUI_ENDPOINT || 'http://host.docker.internal:8000/prompt';
    
    const comfyResponse = await fetch(comfyUIEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!comfyResponse.ok) {
      throw new Error(`ComfyUI API error: ${comfyResponse.status}`);
    }

    const result = await comfyResponse.json();
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('ComfyUI API error:', error);
    return NextResponse.json(
      { error: 'Failed to process ComfyUI request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
</write_to_file>
