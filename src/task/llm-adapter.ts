import type { LLMAdapter, LLMAdapterConfig } from "../task-types.ts";
import { ClaudeAdapter } from "./adapters/claude.ts";
import { OpenAIAdapter } from "./adapters/openai.ts";

/**
 * Create an LLM adapter based on provider configuration
 */
export function createAdapter(
  provider: "claude" | "openai",
  config: LLMAdapterConfig
): LLMAdapter {
  switch (provider) {
    case "claude":
      return new ClaudeAdapter(config);
    case "openai":
      return new OpenAIAdapter(config);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Create an adapter from environment variables
 */
export function createAdapterFromEnv(): LLMAdapter {
  const provider = (Bun.env.LLM_PROVIDER || "claude") as "claude" | "openai";
  const apiKey = Bun.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error("LLM_API_KEY environment variable is required");
  }

  const model = Bun.env.LLM_MODEL || getDefaultModel(provider);
  const baseUrl = Bun.env.LLM_BASE_URL;

  const config: LLMAdapterConfig = {
    model,
    apiKey,
    baseUrl,
    maxTokens: Bun.env.LLM_MAX_TOKENS
      ? parseInt(Bun.env.LLM_MAX_TOKENS, 10)
      : 4096,
    temperature: Bun.env.LLM_TEMPERATURE
      ? parseFloat(Bun.env.LLM_TEMPERATURE)
      : 0,
  };

  return createAdapter(provider, config);
}

function getDefaultModel(provider: "claude" | "openai"): string {
  if (provider === "claude") {
    return "claude-opus-4-5";
  }
  return "gpt-4";
}

// Re-export types for convenience
export type { LLMAdapter, LLMAdapterConfig } from "../task-types.ts";
export { ClaudeAdapter } from "./adapters/claude.ts";
export { OpenAIAdapter } from "./adapters/openai.ts";
