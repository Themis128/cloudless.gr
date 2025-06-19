# Ollama AI Integration Setup

This project uses Ollama for AI-powered description generation. Follow these steps to set it up:

## 1. Install Ollama

### Windows

```bash
# Download and install from: https://ollama.ai/download
# Or use winget:
winget install Ollama.Ollama
```

### macOS

```bash
# Download from: https://ollama.ai/download
# Or use Homebrew:
brew install ollama
```

### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

## 2. Start Ollama Server

```bash
ollama serve
```

The server will start on `http://localhost:11434` by default.

## 3. Pull a Model

```bash
# Recommended model for text generation
ollama pull llama3.2:latest

# Alternative models:
# ollama pull llama3.1:latest
# ollama pull mistral:latest
# ollama pull codellama:latest
```

## 4. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest
```

## 5. Test the Integration

1. Start the Nuxt development server: `npm run dev`
2. Navigate to the Projects page
3. Create a project without a description
4. Click the "🧠 Generate Description" button
5. The AI will generate a description using Ollama

## Available Models

- **llama3.2:latest** - Latest Llama model (recommended)
- **llama3.1:latest** - Previous Llama version
- **mistral:latest** - Mistral model (good for creative text)
- **codellama:latest** - Code-focused model

## Troubleshooting

### "Ollama service is not available"

- Make sure Ollama is running: `ollama serve`
- Check if the service is accessible: `curl http://localhost:11434/api/tags`

### "Model not found"

- Pull the model: `ollama pull llama3.2:latest`
- List available models: `ollama list`

### Performance Tips

- Use smaller models for faster responses (e.g., `llama3.2:1b`)
- Configure GPU acceleration if available
- Adjust the `num_predict` parameter in the API route for longer/shorter descriptions
