# LLM Integration (Portable)

This project demonstrates a portable integration for a local LLM (Large Language Model) API in a Nuxt 3 app.

## How it works

- All LLM API logic is encapsulated in `utils/codeLlama.ts`.
- The API endpoint and model are configurable via environment variables.
- The UI is componentized (see `components/MyGeneratedComponent.vue`).
- The backend API is proxied via Nuxt server routes (see `server/api/generate.ts`).

## Usage in Your Project

1. **Copy the utility**

   - Copy `utils/codeLlama.ts` to your project.

2. **Copy the server API route**

   - Copy `server/api/generate.ts` to your Nuxt project's `server/api/` directory.

3. **Set environment variables**

   - Copy `.env.example` to `.env` and set your LLM API URL and model.

4. **Use the utility in your components**

   - Import and call `generateLLMResponse(prompt, onData?)` in your Vue components or composables.

5. **Componentize your UI**
   - Use or adapt `components/MyGeneratedComponent.vue` for your LLM chat/editor UI.

## Environment Variables

See `.env.example` for required variables:

```
LLM_API_URL=http://localhost:11434/api/generate
LLM_MODEL=phind-codellama:34b
```

## Making it Even More Portable

- Accept endpoint/model as props in your UI component.
- Use slots for custom UI.
- Document all props/events in your component.

## Example

```ts
import { generateLLMResponse } from '@/utils/codeLlama';

const response = await generateLLMResponse('Your prompt here');
```

---

**You can now reuse this LLM integration in any Nuxt or JavaScript project!**
