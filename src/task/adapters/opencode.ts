import { createOpencode } from "@opencode-ai/sdk";
import type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMMessage,
  LLMResponse,
  LLMTool,
  LLMTextContent,
  LLMImageContent,
} from "../../task-types.ts";

interface OpenCodePart {
  type: string;
  text?: string;
  image?: {
    format: string;
    data: string;
  };
}

interface OpenCodeMessage {
  role: "user" | "assistant";
  parts: OpenCodePart[];
}

export class OpencodeAdapter implements LLMAdapter {
  readonly modelId: string;
  readonly providerId: string;
  private defaultConfig: Partial<LLMAdapterConfig>;
  private clientPromise: Promise<any>;

  constructor(config: LLMAdapterConfig) {
    this.modelId = config.model;
    this.providerId = config.providerId || "anthropic";
    this.defaultConfig = {
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0,
      systemPrompt: config.systemPrompt,
    };
    this.clientPromise = createOpencode();
  }

  async chat(
    messages: LLMMessage[],
    tools: LLMTool[],
    config?: Partial<LLMAdapterConfig>
  ): Promise<LLMResponse> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const { client } = await this.clientPromise;

    try {
      // Create a session
      const session = await client.session.create({
        body: { title: "axagent-task" },
      });

      // Convert messages to opencode format
      const opencodeParts: OpenCodePart[] = [];

      // Add system prompt as initial instruction
      if (mergedConfig.systemPrompt) {
        opencodeParts.push({
          type: "text",
          text: mergedConfig.systemPrompt,
        });
      }

      // Convert LLM messages to opencode format
      for (const msg of messages) {
        if (msg.role === "user") {
          for (const content of msg.content) {
            if (content.type === "text") {
              opencodeParts.push({
                type: "text",
                text: (content as LLMTextContent).text,
              });
            } else if (content.type === "image") {
              const imgContent = content as LLMImageContent;
              opencodeParts.push({
                type: "image",
                image: {
                  format: this.getImageFormat(imgContent.mediaType),
                  data: imgContent.data,
                },
              });
            }
          }
        }
      }

      // Build tool descriptions for context
      let toolContext = "";
      if (tools.length > 0) {
        toolContext =
          "\n\nAvailable tools:\n" +
          tools
            .map(
              (t) =>
                `- ${t.name}: ${t.description}\n  Schema: ${JSON.stringify(t.inputSchema)}`
            )
            .join("\n");
        opencodeParts.push({
          type: "text",
          text: toolContext,
        });
      }

      // Send prompt to opencode
      const response = await client.session.prompt({
        path: { id: session.id },
        body: {
          model: {
            providerID: this.providerId,
            modelID: this.modelId,
          },
          parts: opencodeParts,
          max_tokens: mergedConfig.maxTokens || 4096,
          temperature: mergedConfig.temperature ?? 0,
        },
      });

      // Parse response
      const responseText = this.extractResponseText(response);
      const toolCalls = this.extractToolCalls(responseText, tools);

      return {
        message: {
          role: "assistant",
          content: [{ type: "text", text: responseText }],
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens || 0,
              outputTokens: response.usage.output_tokens || 0,
            }
          : undefined,
        stopReason: this.mapStopReason(response.stop_reason),
      };
    } catch (error) {
      throw new Error(
        `Opencode API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getImageFormat(mediaType: string): string {
    switch (mediaType) {
      case "image/jpeg":
        return "jpeg";
      case "image/webp":
        return "webp";
      case "image/png":
      default:
        return "png";
    }
  }

  private extractResponseText(response: any): string {
    if (Array.isArray(response.parts)) {
      return response.parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text || "")
        .join("");
    }
    return response.text || "";
  }

  private extractToolCalls(
    responseText: string,
    tools: LLMTool[]
  ): Array<{ id: string; name: string; input: Record<string, unknown> }> {
    const toolCalls: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];

    // Look for JSON blocks in the response that match tool schemas
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
    let match;

    while ((match = jsonBlockRegex.exec(responseText)) !== null) {
      try {
        const jsonStr = match[1].trim();
        const parsed = JSON.parse(jsonStr);

        // Check if this looks like a tool call
        if (parsed.tool_name && tools.some((t) => t.name === parsed.tool_name)) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: parsed.tool_name,
            input: parsed.input || {},
          });
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    return toolCalls;
  }

  private mapStopReason(
    reason: string
  ): "tool_use" | "end_turn" | "max_tokens" | "stop_sequence" {
    if (reason?.includes("tool")) return "tool_use";
    if (reason?.includes("max")) return "max_tokens";
    if (reason?.includes("stop")) return "stop_sequence";
    return "end_turn";
  }
}
