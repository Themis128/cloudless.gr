// Define a stable client id or use env var
const CLIENT_ID = process.env.COMFY_CLIENT_ID || "cloudless-test-override";

// Normalizer + validator for ComfyUI prompt payloads
function normalizeAndValidatePrompt(promptObj: Record<string, any>) {
  const nameMap = {
    PrimitiveNode: "Primitive",
    Primitive: "Primitive",
    "String Constant": "PrimitiveString",
  };

  for (const [nodeId, nodeStruct] of Object.entries(promptObj)) {
    if (typeof nodeStruct !== "object" || nodeStruct === null) {
      throw new Error(
        `Invalid node structure for node ${nodeId}: expected object, got ${typeof nodeStruct}`
      );
    }

    if (!("class_type" in nodeStruct)) {
      throw new Error(`Missing class_type for node ${nodeId}`);
    }
    const rawType = nodeStruct.class_type;
    if (typeof rawType === "string") {
      nodeStruct.class_type = (nameMap as Record<string, string>)[rawType] ?? rawType;
    }

    if (
      !("inputs" in nodeStruct) ||
      typeof nodeStruct.inputs !== "object" ||
      nodeStruct.inputs === null
    ) {
      throw new Error(`Missing or invalid inputs for node ${nodeId}`);
    }

    for (const [inputKey, inputVal] of Object.entries(nodeStruct.inputs)) {
      if (Array.isArray(inputVal)) {
        // Accept single connection ["nodeId", index] or array of such connections
        if (
          inputVal.length === 2 &&
          typeof inputVal[0] === "string" &&
          Number.isInteger(inputVal[1])
        ) {
          continue;
        }
        if (
          inputVal.every(
            (v) =>
              Array.isArray(v) &&
              v.length === 2 &&
              typeof v[0] === "string" &&
              Number.isInteger(v[1])
          )
        ) {
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
// Uses local CPU models when REPLICATE_API_TOKEN is not set, otherwise uses Replicate (cloud)
export function buildPayloadForSmokeTest(
  workflow: any = {},
  includeMetadata: boolean = false,
  format: string = "json"
) {
  // If REPLICATE_API_TOKEN is set, use the cloud-based Replicate node
  if (process.env.REPLICATE_API_TOKEN) {
    const payload = {
      client_id: CLIENT_ID,
      prompt: {
        "1": {
          class_type: "PrimitiveString",
          inputs: {
            value:
              "A clean, modern flat minimalist infographic layout background, high contrast corporate accent waves, optimized for corporate carousel slide backgrounds --ar 1:1",
          },
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
            api_key: process.env.REPLICATE_API_TOKEN || "",
          },
        },
        "3": {
          class_type: "SaveImage",
          inputs: {
            images: ["2", 0],
            filename_prefix: "flux-schnell-social",
          },
        },
      },
    };
    return { client_id: payload.client_id, prompt: normalizeAndValidatePrompt(payload.prompt) };
  }

  // Fallback to local CPU models
  const payload = {
    client_id: CLIENT_ID,
    prompt: {
      "1": {
        // PrimitiveString for positive prompt
        class_type: "PrimitiveString",
        inputs: {
          value:
            "A clean, modern flat minimalist infographic layout background, high contrast corporate accent waves, optimized for corporate carousel slide backgrounds --ar 1:1",
        },
      },
      "2": {
        // PrimitiveString for negative prompt (empty)
        class_type: "PrimitiveString",
        inputs: {
          value: "",
        },
      },
      "3": {
        // CheckpointLoaderSimple
        class_type: "CheckpointLoaderSimple",
        inputs: {
          ckpt_name: process.env.COMFYUI_CHECKPOINT || "sd_xl_base_1.0.safetensors",
        },
      },
      "4": {
        // CLIPTextEncode for positive
        class_type: "CLIPTextEncode",
        inputs: {
          text: ["1", 0],
          clip: ["3", 1],
        },
      },
      "5": {
        // CLIPTextEncode for negative
        class_type: "CLIPTextEncode",
        inputs: {
          text: ["2", 0],
          clip: ["3", 1],
        },
      },
      "6": {
        // EmptyLatentImage
        class_type: "EmptyLatentImage",
        inputs: {
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
      },
      "7": {
        // KSampler
        class_type: "KSampler",
        inputs: {
          model: ["3", 0],
          seed: 1331,
          steps: 20,
          cfg: 8,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1,
          positive: ["4", 0],
          negative: ["5", 0],
          latent_image: ["6", 0],
        },
      },
      "8": {
        // VAEDecode
        class_type: "VAEDecode",
        inputs: {
          samples: ["7", 0],
          vae: ["3", 2],
        },
      },
      "9": {
        // SaveImage
        class_type: "SaveImage",
        inputs: {
          images: ["8", 0],
          filename_prefix: "flux-schnell-social",
        },
      },
    },
  };

  // Validate and normalize before returning
  return { client_id: payload.client_id, prompt: normalizeAndValidatePrompt(payload.prompt) };
}

export { normalizeAndValidatePrompt, CLIENT_ID };
