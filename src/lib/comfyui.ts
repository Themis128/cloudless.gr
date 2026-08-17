// Define a stable client id or use env var
const CLIENT_ID = process.env.COMFY_CLIENT_ID || "cloudless-test-override";

// Normalizer + validator for ComfyUI prompt payloads
    function normalizeAndValidatePrompt(promptObj: Record<string, any>) {
      const nameMap = {
        "PrimitiveNode": "Primitive",
        "Primitive": "Primitive",
        "String Constant": "PrimitiveString"
      };

    for (const [nodeId, nodeStruct] of Object.entries(promptObj)) {
      if (typeof nodeStruct !== "object" || nodeStruct === null) {
        throw new Error(`Invalid node structure for node ${nodeId}: expected object, got ${typeof nodeStruct}`);
      }

      if (!("class_type" in nodeStruct)) {
        throw new Error(`Missing class_type for node ${nodeId}`);
      }
      const rawType = nodeStruct.class_type;
      if (typeof rawType === "string") {
        nodeStruct.class_type = nameMap[rawType] ?? rawType;
      }

      if (!("inputs" in nodeStruct) || typeof nodeStruct.inputs !== "object" || nodeStruct.inputs === null) {
        throw new Error(`Missing or invalid inputs for node ${nodeId}`);
      }

       for (const [inputKey, inputVal] of Object.entries(nodeStruct.inputs)) {
         if (Array.isArray(inputVal)) {
           // Accept single connection ["nodeId", index] or array of such connections
           if (inputVal.length === 2 && typeof inputVal[0] === "string" && Number.isInteger(inputVal[1])) {
             continue;
           }
           if (inputVal.every(v => Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && Number.isInteger(v[1]))) {
             continue;
           }
           throw new Error(`Invalid connection array for node ${nodeId} input ${inputKey}`);
         } else {
           // Allow literal values (string, number, boolean, etc.)
           continue;
         }
       }
    }
    return promptObj;
  }

// Deterministic payload builder that matches ComfyUI engine keys and link shapes
function buildPayload(workflow: any = {}, includeMetadata: boolean = false, format: string = "json") {
  const payload = {
    client_id: CLIENT_ID,
    prompt: {
      "1": {
        class_type: "PrimitiveString",
        inputs: {
          value: "A clean, modern flat minimalist infographic layout background, high contrast corporate accent waves, optimized for corporate carousel slide backgrounds --ar 1:1"
        }
      },
      "2": {
        class_type: "Replicate black-forest-labs/flux-schnell",
        inputs: {
          prompt: ["1", 0],
          aspect_ratio: "1:1",
          num_outputs: 1,
          seed: 1331,
          output_format: "webp",
          output_quality: 80,
          disable_safety_checker: false,
          go_fast: true,
          megapixels: "1",
          // Add Replicate API token
          api_key: process.env.REPLICATE_API_TOKEN || ""
        }
      },
      "3": {
        class_type: "SaveImage",
        inputs: {
          images: ["2", 0],
          filename_prefix: "flux-schnell-social"
        }
      }
    }
  };

  // Validate and normalize before returning
  return { client_id: payload.client_id, prompt: normalizeAndValidatePrompt(payload.prompt) };
}

export { buildPayload, normalizeAndValidatePrompt, CLIENT_ID };