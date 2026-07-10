import OpenAI from "openai";
import { env } from "../config/env";

let client: OpenAI | null = null;

type HuggingFaceChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function getClient() {
  if (!env.openAiApiKey) {
    return null;
  }

  client ??= new OpenAI({ apiKey: env.openAiApiKey });
  return client;
}

function parseJsonResponse<T>(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(jsonText) as T;
}

async function generateHuggingFaceJson<T>({
  system,
  prompt,
}: {
  system: string;
  prompt: string;
}) {
  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.huggingFaceApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.huggingFaceModel,
      messages: [
        {
          role: "system",
          content: `${system}\n\nReturn only valid JSON. Do not wrap the response in markdown.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face generation request failed: ${errorText || response.statusText}`);
  }

  const payload = (await response.json()) as HuggingFaceChatResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Hugging Face generation returned an empty response.");
  }

  return parseJsonResponse<T>(content);
}

export function getAiProviderStatus() {
  if (env.huggingFaceApiKey) {
    return {
      provider: "Hugging Face",
      model: env.huggingFaceModel,
      configured: true,
      telemetryAvailable: false,
      message: "Hugging Face generation is configured. Provider token usage telemetry is not exposed through this app.",
    };
  }

  if (env.openAiApiKey) {
    return {
      provider: "OpenAI",
      model: env.openAiModel,
      configured: true,
      telemetryAvailable: false,
      message: "OpenAI generation is configured. Provider telemetry is not exposed through this app.",
    };
  }

  return {
    provider: "None",
    model: "",
    configured: false,
    telemetryAvailable: false,
    message: "No AI provider key is configured.",
  };
}

export async function generateAiJson<T>({
  system,
  prompt,
  fallback,
  allowFallback = true,
}: {
  system: string;
  prompt: string;
  fallback: T;
  allowFallback?: boolean;
}) {
  // Prefer HuggingFace if available
  if (env.huggingFaceApiKey) {
    try {
      return await generateHuggingFaceJson<T>({ system, prompt });
    } catch (error) {
      if (allowFallback) {
        return fallback;
      }
      throw new Error(
        `Hugging Face generation failed${error instanceof Error && error.message ? `: ${error.message}` : "."}`,
      );
    }
  }

  const openai = getClient();

  if (!openai) {
    if (allowFallback) {
      return fallback;
    }

    throw new Error("AI generation is unavailable because no AI provider is configured.");
  }

  try {
    const response = await openai.responses.create({
      model: env.openAiModel,
      text: {
        format: {
          type: "json_object",
        },
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
    });

    return parseJsonResponse<T>(response.output_text);
  } catch (error) {
    if (allowFallback) {
      return fallback;
    }

    throw new Error(
      `AI generation failed${error instanceof Error && error.message ? `: ${error.message}` : "."}`,
    );
  }
}
