export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY!,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
  XAI_API_KEY: process.env.XAI_API_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  HERMES_API_URL: process.env.HERMES_API_URL || "https://agent.kryos.dev",
  HERMES_API_KEY: process.env.HERMES_API_KEY!,
  LITELLM_URL: process.env.LITELLM_URL || "http://127.0.0.1:4000",
  LITELLM_MASTER_KEY: process.env.LITELLM_MASTER_KEY!,
}

export function createEnvWithUserKeys(
  userKeys: Record<string, string> = {}
): typeof env {
  return {
    OPENAI_API_KEY: userKeys.openai || env.OPENAI_API_KEY,
    MISTRAL_API_KEY: userKeys.mistral || env.MISTRAL_API_KEY,
    PERPLEXITY_API_KEY: userKeys.perplexity || env.PERPLEXITY_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY:
      userKeys.google || env.GOOGLE_GENERATIVE_AI_API_KEY,
    ANTHROPIC_API_KEY: userKeys.anthropic || env.ANTHROPIC_API_KEY,
    XAI_API_KEY: userKeys.xai || env.XAI_API_KEY,
    OPENROUTER_API_KEY: userKeys.openrouter || env.OPENROUTER_API_KEY,
    HERMES_API_URL: env.HERMES_API_URL,
    HERMES_API_KEY: userKeys.hermes || env.HERMES_API_KEY,
    LITELLM_URL: env.LITELLM_URL,
    LITELLM_MASTER_KEY: env.LITELLM_MASTER_KEY,
  }
}
