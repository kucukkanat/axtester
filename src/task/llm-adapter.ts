import { OpencodeAdapter } from "./adapters/opencode.ts";
import type { LLMAdapter, LLMAdapterConfig } from "../task-types.ts";

/**
 * Create an LLM adapter using opencode SDK
 * Connects to local opencode instance - no API keys needed
 */
export function createAdapter(config: LLMAdapterConfig): LLMAdapter {
  return new OpencodeAdapter(config);
}

/**
 * Create an adapter from environment variables
 * Reads LLM_PROVIDER_ID and LLM_MODEL from environment
 */
export function createAdapterFromEnv(): LLMAdapter {
  const model =
    Bun.env.LLM_MODEL || "claude-opus-4-5";
  const providerId = Bun.env.LLM_PROVIDER_ID || "anthropic";

  const config: LLMAdapterConfig = {
    model,
    providerId,
    maxTokens: Bun.env.LLM_MAX_TOKENS
      ? parseInt(Bun.env.LLM_MAX_TOKENS, 10)
      : 4096,
    temperature: Bun.env.LLM_TEMPERATURE
      ? parseFloat(Bun.env.LLM_TEMPERATURE)
      : 0,
    systemPrompt: Bun.env.LLM_SYSTEM_PROMPT,
  };

  return createAdapter(config);
}

// Re-export types for convenience
export type { LLMAdapter, LLMAdapterConfig } from "../task-types.ts";
export { OpencodeAdapter } from "./adapters/opencode.ts";
