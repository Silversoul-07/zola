import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI, google } from "@ai-sdk/google"
import { createMistral, mistral } from "@ai-sdk/mistral"
import { createOpenAI, openai } from "@ai-sdk/openai"
import { createPerplexity, perplexity } from "@ai-sdk/perplexity"
import { createXai, xai } from "@ai-sdk/xai"
import type { LanguageModel } from "ai"
import { getProviderForModel } from "./provider-map"
import type {
  AnthropicModel,
  GeminiModel,
  LiteLLMModel,
  MistralModel,
  OllamaModel,
  OpenAIModel,
  PerplexityModel,
  SupportedModel,
  XaiModel,
} from "./types"

// v5+ provider factories take only a model id (no per-call settings object);
// per-provider options now live on createXxx(...) instead. Nothing in this
// codebase called openproviders() with a `settings` value (always
// `undefined`), so that param is dropped rather than plumbed through.
export type OpenProvidersOptions = undefined

// Get Ollama base URL from environment or use default
const getOllamaBaseURL = () => {
  if (typeof window !== "undefined") {
    // Client-side: use localhost
    return "http://localhost:11434/v1"
  }

  // Server-side: check environment variables
  return (
    process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "") + "/v1" ||
    "http://localhost:11434/v1"
  )
}

// Create Ollama provider instance with configurable baseURL
const createOllamaProvider = () => {
  return createOpenAI({
    baseURL: getOllamaBaseURL(),
    apiKey: "ollama", // Ollama doesn't require a real API key
    name: "ollama",
  })
}

// Create LiteLLM provider instance (our own gateway, OpenAI-compatible)
const createLiteLLMProvider = () => {
  return createOpenAI({
    baseURL: `${process.env.LITELLM_URL}/v1`,
    apiKey: process.env.LITELLM_MASTER_KEY,
    name: "litellm",
  })
}

export function openproviders<T extends SupportedModel>(
  modelId: T,
  _settings?: OpenProvidersOptions,
  apiKey?: string
): LanguageModel {
  const provider = getProviderForModel(modelId)

  if (provider === "openai") {
    if (apiKey) {
      const openaiProvider = createOpenAI({ apiKey })
      return openaiProvider(modelId as OpenAIModel)
    }
    return openai(modelId as OpenAIModel)
  }

  if (provider === "mistral") {
    if (apiKey) {
      const mistralProvider = createMistral({ apiKey })
      return mistralProvider(modelId as MistralModel)
    }
    return mistral(modelId as MistralModel)
  }

  if (provider === "google") {
    if (apiKey) {
      const googleProvider = createGoogleGenerativeAI({ apiKey })
      return googleProvider(modelId as GeminiModel)
    }
    return google(modelId as GeminiModel)
  }

  if (provider === "perplexity") {
    if (apiKey) {
      const perplexityProvider = createPerplexity({ apiKey })
      return perplexityProvider(modelId as PerplexityModel)
    }
    return perplexity(modelId as PerplexityModel)
  }

  if (provider === "anthropic") {
    if (apiKey) {
      const anthropicProvider = createAnthropic({ apiKey })
      return anthropicProvider(modelId as AnthropicModel)
    }
    return anthropic(modelId as AnthropicModel)
  }

  if (provider === "xai") {
    if (apiKey) {
      const xaiProvider = createXai({ apiKey })
      return xaiProvider(modelId as XaiModel)
    }
    return xai(modelId as XaiModel)
  }

  if (provider === "ollama") {
    const ollamaProvider = createOllamaProvider()
    return ollamaProvider(modelId as OllamaModel)
  }

  if (provider === "litellm") {
    const litellmProvider = createLiteLLMProvider()
    return litellmProvider(modelId as LiteLLMModel)
  }

  throw new Error(`Unsupported model: ${modelId}`)
}
