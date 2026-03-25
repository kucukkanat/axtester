import OpenAI from "openai";
import type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMMessage,
  LLMResponse,
  LLMTool,
  LLMContent,
  LLMTextContent,
  LLMImageContent,
} from "../../task-types.ts";

export class OpenAIAdapter implements LLMAdapter {
  readonly modelId: string;
  private client: OpenAI;
  private defaultConfig: Partial<LLMAdapterConfig>;

  constructor(config: LLMAdapterConfig) {
    this.modelId = config.model;

    const clientConfig: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey: config.apiKey,
    };

    if (config.baseUrl) {
      clientConfig.baseURL = config.baseUrl;
    }

    this.client = new OpenAI(clientConfig);

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

    // Convert messages to OpenAI format
    const openaiMessages = messages.map((msg) =>
      this.convertMessage(msg)
    );

    // Add system message if provided
    if (mergedConfig.systemPrompt) {
      openaiMessages.unshift({
        role: "system",
        content: mergedConfig.systemPrompt,
      });
    }

    // Convert tools to OpenAI format
    const openaiTools = tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    const requestParams: Parameters<typeof this.client.chat.completions.create>[0] = {
      model: this.modelId,
      messages: openaiMessages,
      max_tokens: mergedConfig.maxTokens || 4096,
      temperature: mergedConfig.temperature ?? 0,
    };

    if (openaiTools.length > 0) {
      requestParams.tools = openaiTools;
      requestParams.tool_choice = "auto";
    }

    try {
      const response = await this.client.chat.completions.create(requestParams);

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error("No message in response");
      }

      // Convert response back to our format
      return {
        message: this.convertResponse(message),
        usage: response.usage
          ? {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
            }
          : undefined,
        stopReason: this.mapStopReason(response.choices[0]?.finish_reason || ""),
      };
    } catch (error) {
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private convertMessage(msg: LLMMessage) {
    if (msg.role === "tool") {
      // Tool result message
      const firstContent = msg.content[0];
      const toolResult =
        firstContent.type === "text"
          ? (firstContent as LLMTextContent).text
          : JSON.stringify(firstContent);

      return {
        role: "tool" as const,
        tool_call_id: msg.toolCallId || "",
        content: toolResult,
      };
    }

    // Convert content
    const content = msg.content.map((c) => this.convertContent(c));

    // Build OpenAI message
    const openaiMsg: any = {
      role: msg.role === "assistant" ? "assistant" : "user",
      content,
    };

    // Add tool calls if present
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      openaiMsg.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input),
        },
      }));
    }

    return openaiMsg;
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
        type: "image_url" as const,
        image_url: {
          url: `data:${img.mediaType};base64,${img.data}`,
        },
      };
    }

    throw new Error(`Unknown content type: ${(content as LLMContent).type}`);
  }

  private convertResponse(message: any) {
    const content = [];
    const toolCalls = [];

    // Handle text content
    if (message.content) {
      content.push({
        type: "text" as const,
        text: message.content,
      });
    }

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        if (tc.type === "function") {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
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
    if (reason === "tool_calls") return "tool_use";
    if (reason === "max_tokens") return "max_tokens";
    if (reason === "stop") return "stop_sequence";
    return "end_turn";
  }
}
