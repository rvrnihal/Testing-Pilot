import "dotenv/config";

function parseCorsOrigins(input?: string) {
  const defaults = ["http://localhost:3000", "http://127.0.0.1:3000"];

  if (!input?.trim()) {
    return defaults;
  }

  const configuredOrigins = input
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allOrigins = new Set<string>();
  for (const origin of [...configuredOrigins, ...defaults]) {
    allOrigins.add(origin);
    if (origin.includes("://localhost:")) {
      allOrigins.add(origin.replace("://localhost:", "://127.0.0.1:"));
    } else if (origin.includes("://127.0.0.1:")) {
      allOrigins.add(origin.replace("://127.0.0.1:", "://localhost:"));
    }
  }

  return Array.from(allOrigins);
}

export const env = {
  apiPort: Number(process.env.PORT || process.env.API_PORT || 4000),
  apiHost: process.env.API_HOST || process.env.HOST || "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET || "change-me-super-secret",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "",
  huggingFaceModel: process.env.HUGGINGFACE_MODEL || "Qwen/Qwen2.5-7B-Instruct",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};
