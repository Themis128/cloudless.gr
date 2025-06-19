import { Ollama } from 'ollama';

// Initialize Ollama client
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { name, type } = body;

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Project name is required',
      });
    }

    // Get the model from environment or use default
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2:latest';

    const systemPrompt =
      'You are an AI assistant that writes short, professional project descriptions for data science and machine learning workflows. Keep descriptions concise, clear, and informative (2-3 sentences max).';

    const userPrompt = type
      ? `Write a short, clear description for a ${type} machine learning project called "${name}".`
      : `Write a short, clear description for a machine learning project called "${name}".`;

    // Check if Ollama is available and model exists
    try {
      await ollama.list();
    } catch (ollamaError) {
      console.error('Ollama connection error:', ollamaError);
      throw createError({
        statusCode: 503,
        statusMessage: 'Ollama service is not available. Please ensure Ollama is running.',
      });
    }

    const response = await ollama.chat({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 150,
      },
    });

    const description = response.message?.content?.trim();

    if (!description) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to generate description',
      });
    }

    return {
      description,
    };
  } catch (error: any) {
    console.error('AI description generation error:', error);

    if (error.statusCode) {
      throw error;
    }

    // Handle Ollama specific errors
    if (error.message?.includes('model')) {
      throw createError({
        statusCode: 404,
        statusMessage: `Model not found. Please ensure the model is installed in Ollama.`,
      });
    }

    if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
      throw createError({
        statusCode: 503,
        statusMessage:
          'Cannot connect to Ollama. Please ensure Ollama is running on the specified host.',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate description',
    });
  }
});
