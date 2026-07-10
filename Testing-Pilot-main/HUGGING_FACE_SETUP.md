# Using Hugging Face API with QA Copilot

This guide explains how to use Hugging Face as your AI provider instead of or alongside OpenAI.

## Overview

QA Copilot now prioritizes Hugging Face API when available. If you set up the `HUGGINGFACE_API_KEY` environment variable, the application will use Hugging Face for all AI-powered features. OpenAI is available as a fallback option.

## Setup Instructions

### 1. Get a Hugging Face API Key

1. Visit [Hugging Face](https://huggingface.co/)
2. Sign up or log in to your account
3. Go to [Settings → Access Tokens](https://huggingface.co/settings/tokens)
4. Click "New token"
5. Name it (e.g., "QA Copilot")
6. Set the token type to "Read" (sufficient for inference)
7. Copy the generated token

### 2. Configure Environment Variables

Update your `.env` file (or `.env.local` for local development):

```env
# Hugging Face AI Provider (Primary)
HUGGINGFACE_API_KEY="your_hugging_face_api_key_here"
HUGGINGFACE_MODEL="Qwen/Qwen2.5-7B-Instruct"

# OpenAI (Optional - used as fallback if Hugging Face is not available)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
```

### 3. Restart Your Application

After updating environment variables, restart your application for the changes to take effect:

```bash
# If using Docker
docker compose restart api

# Or if running locally
npm run dev
```

## Available Models

The default Hugging Face model is `Qwen/Qwen2.5-7B-Instruct`. You can use other compatible models:

- `mistralai/Mistral-7B-Instruct-v0.1`
- `meta-llama/Llama-2-7b-chat`
- `mistralai/Mistral-Nemo`
- Any model available on the Hugging Face Inference API

To change the model, update `HUGGINGFACE_MODEL`:

```env
HUGGINGFACE_MODEL="mistralai/Mistral-7B-Instruct-v0.1"
```

## Behavior

### Priority Order

The application follows this priority order for AI providers:

1. **Hugging Face** (if `HUGGINGFACE_API_KEY` is set)
2. **OpenAI** (if `OPENAI_API_KEY` is set and Hugging Face is not available)
3. **Fallback** (returns default values if no provider is configured)

### AI Provider Status

You can check which AI provider is active by calling the `/api/admin/provider-status` endpoint or checking the admin dashboard.

## Troubleshooting

### "Hugging Face generation request failed"

- Verify your API key is correct in the environment variables
- Check that your Hugging Face account has active API tokens
- Ensure you have sufficient API quota
- Verify the model name is spelled correctly

### Rate Limiting

Hugging Face has rate limits on their inference API. If you encounter rate limit errors:

- Consider using a paid Hugging Face account
- Implement request queuing in your application
- Use local model deployment for higher throughput

## Cost Considerations

- **Hugging Face**: Generally lower cost for inference-only tasks
- **OpenAI**: More mature models but higher per-request costs

Compare your usage patterns with each provider's pricing to determine the best option for your needs.

## Disabling OpenAI

To ensure only Hugging Face is used and completely disable OpenAI:

```env
# Required
HUGGINGFACE_API_KEY="your_api_key"
HUGGINGFACE_MODEL="Qwen/Qwen2.5-7B-Instruct"

# Leave empty or omit entirely
OPENAI_API_KEY=""
```

## More Information

- [Hugging Face Documentation](https://huggingface.co/docs)
- [Hugging Face Inference API](https://huggingface.co/inference-api)
- [QA Copilot Tool Documentation](docs/TOOL_DOCUMENTATION.md)
