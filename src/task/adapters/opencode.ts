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

    try {
      const { client } = await Promise.race([
        this.clientPromise,
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Opencode connection timeout")), 5000)
        ),
      ]);

      // Create a session with timeout
      const session = await Promise.race([
        client.session.create({
          body: { title: `axagent-task-${Date.now()}` },
        }),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Session creation timeout")), 10000)
        ),
      ]);

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

      // Send prompt to opencode with timeout
      const response = await Promise.race([
        client.session.prompt({
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
        }),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Opencode prompt timeout (60s)")), 60000)
        ),
      ]);

      // OpenCode SDK wraps response in { error, request, response }
      const actualResponse = response.response || response;

      // Parse response
      const responseText = this.extractResponseText(actualResponse);
      const toolCalls = this.extractToolCalls(responseText, tools);

      // Extract tokens from the nested response
      let usage: { inputTokens: number; outputTokens: number } | undefined;
      if (actualResponse.usage) {
        usage = {
          inputTokens: actualResponse.usage.input_tokens || actualResponse.usage.inputTokens || 0,
          outputTokens: actualResponse.usage.output_tokens || actualResponse.usage.outputTokens || 0,
        };
      }

      return {
        message: {
          role: "assistant",
          content: [{ type: "text", text: responseText }],
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        usage,
        stopReason: this.mapStopReason(actualResponse.stop_reason || "end_turn"),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Opencode API error: ${message}\n\nMake sure:\n1. opencode service is running locally\n2. LLM_PROVIDER_ID="${this.providerId}" is available\n3. LLM_MODEL="${this.modelId}" exists in your setup`
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
    // Debug log response structure
    if (!globalThis.__opencodeResponseLogged) {
      globalThis.__opencodeResponseLogged = true;
      console.error("[DEBUG] Actual Response Structure:");
      console.error("Response keys:", Object.keys(response));
      console.error("Response.parts:", Array.isArray(response.parts) ? `${response.parts.length} items` : typeof response.parts);
      if (Array.isArray(response.parts) && response.parts.length > 0) {
        console.error("First part:", JSON.stringify(response.parts[0], null, 2).slice(0, 500));
      }
      console.error("Response.text:", typeof response.text, response.text?.slice(0, 100));
      console.error("Response.message:", typeof response.message);
      console.error("Response keys:", Object.keys(response).slice(0, 20));
    }

    if (Array.isArray(response.parts)) {
      return response.parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text || "")
        .join("");
    }
    return response.text || response.message || "";
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
