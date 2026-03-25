import { Anthropic } from "@anthropic-ai/sdk";
import type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMMessage,
  LLMResponse,
  LLMTool,
  LLMContent,
  LLMImageContent,
  LLMTextContent,
} from "../../task-types.ts";

export class ClaudeAdapter implements LLMAdapter {
  readonly modelId: string;
  private client: Anthropic;
  private defaultConfig: Partial<LLMAdapterConfig>;

  constructor(config: LLMAdapterConfig) {
    this.modelId = config.model;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.defaultConfig = {
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0,
      systemPrompt: config.systemPrompt,
    };
  }

  async chat(
    messages: LLMMessage[],
    tools: LLMTool[],
    config?: Partial<LLMAdapterConfig>
  ): Promise<LLMResponse> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg) =>
      this.convertMessage(msg)
    );

    // Convert tools to Anthropic format
    const anthropicTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    // Build request
    const requestParams: Parameters<typeof this.client.messages.create>[0] = {
      model: this.modelId,
      max_tokens: mergedConfig.maxTokens || 4096,
      temperature: mergedConfig.temperature ?? 0,
      messages: anthropicMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    };

    // Add system prompt if provided
    if (mergedConfig.systemPrompt) {
      requestParams.system = mergedConfig.systemPrompt;
    }

    try {
      const response = await this.client.messages.create(
        requestParams
      );

      // Convert response back to our format
      return {
        message: this.convertResponse(response),
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
            }
          : undefined,
        stopReason: this.mapStopReason(response.stop_reason),
      };
    } catch (error) {
      throw new Error(
        `Claude API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private convertMessage(msg: LLMMessage) {
    if (msg.role === "tool") {
      // Tool result message
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: msg.toolCallId || "",
            content: JSON.stringify(msg.content[0]),
          },
        ],
      };
    }

    // Regular message
    const content: any[] = msg.content.map((c) => this.convertContent(c));

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      // Add tool use blocks
      const toolCalls = msg.toolCalls.map((tc) => ({
        type: "tool_use" as const,
        id: tc.id,
        name: tc.name,
        input: tc.input,
      }));

      content.push(...toolCalls);
    }

    return {
      role: msg.role as "user" | "assistant",
      content,
    };
  }

  private convertContent(content: LLMContent) {
    if (content.type === "text") {
      return {
        type: "text" as const,
        text: (content as LLMTextContent).text,
      };
    }

    if (content.type === "image") {
      const img = content as LLMImageContent;
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mediaType,
          data: img.data,
        },
      };
    }

    throw new Error(`Unknown content type: ${(content as LLMContent).type}`);
  }

  private convertResponse(response: any) {
    const contentBlocks = response.content || [];
    const content = [];
    const toolCalls = [];

    for (const block of contentBlocks) {
      if (block.type === "text") {
        content.push({
          type: "text" as const,
          text: block.text,
        });
      } else if (block.type === "tool_use") {
        content.push({
          type: "text" as const,
          text: `[Tool call: ${block.name}]`,
        });

        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    return {
      role: "assistant" as const,
      content: content.length > 0 ? content : [{ type: "text" as const, text: "" }],
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private mapStopReason(
    reason: string
  ): "tool_use" | "end_turn" | "max_tokens" | "stop_sequence" {
    if (reason === "tool_use") return "tool_use";
    if (reason === "max_tokens") return "max_tokens";
    if (reason === "stop_sequence") return "stop_sequence";
    return "end_turn";
  }
}
