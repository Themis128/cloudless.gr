import { describe, it, expect } from "vitest";

export const validComfyPayload = {
  client_id: `cloudless-factory-${Date.now()}`,
  prompt: {
    "1": {
      "inputs": {
        "string": "A clean, modern flat minimalist infographic layout background, high contrast corporate accent waves, optimized for corporate carousel slide backgrounds --ar 1:1"
      },
      "class_type": "PrimitiveNode"
    },
    "2": {
      "inputs": {
        "prompt": [
          "1",
          0
        ]
      },
      "class_type": "Replicate black-forest-labs/flux-schnell"
    },
    "3": {
      "inputs": {
        "images": [
          "2",
          0
        ]
      },
      "class_type": "SaveImage"
    }
  }
};

describe('ComfyUI API Payload Validation', () => {
  it('should have correct structure', () => {
    expect(validComfyPayload).toHaveProperty('client_id');
    expect(validComfyPayload).toHaveProperty('prompt');
    
    expect(validComfyPayload.client_id).toMatch(/^cloudless-factory-\d+$/);
    
    const prompt = validComfyPayload.prompt;
    expect(prompt).toHaveProperty('1');
    expect(prompt).toHaveProperty('2');
    expect(prompt).toHaveProperty('3');
    
    // Validate Node 1: PrimitiveNode
    expect(prompt['1']).toHaveProperty('inputs');
    expect(prompt['1'].inputs).toHaveProperty('string');
    expect(prompt['1'].inputs.string).toContain('clean, modern flat minimalist infographic layout');
    expect(prompt['1'].class_type).toBe('PrimitiveNode');
    
    // Validate Node 2: Replicate black-forest-labs/flux-schnell
    expect(prompt['2']).toHaveProperty('inputs');
    expect(prompt['2'].inputs).toHaveProperty('prompt');
    expect(Array.isArray(prompt['2'].inputs.prompt)).toBe(true);
    expect(prompt['2'].inputs.prompt).toEqual(['1', 0]);
    expect(prompt['2'].class_type).toBe('Replicate black-forest-labs/flux-schnell');
    
    // Validate Node 3: SaveImage
    expect(prompt['3']).toHaveProperty('inputs');
    expect(prompt['3'].inputs).toHaveProperty('images');
    expect(Array.isArray(prompt['3'].inputs.images)).toBe(true);
    expect(prompt['3'].inputs.images).toEqual(['2', 0]);
    expect(prompt['3'].class_type).toBe('SaveImage');
  });
});