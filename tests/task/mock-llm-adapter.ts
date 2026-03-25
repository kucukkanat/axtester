import type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMMessage,
  LLMResponse,
  LLMTool,
} from "../../src/task-types.ts";

export interface MockLLMScriptStep {
  toolName: string;
  toolInput: Record<string, unknown>;
  stopReason?: "tool_use" | "end_turn";
}

/**
 * Mock LLM adapter for testing - plays back a pre-scripted sequence of tool calls
 */
export class MockLLMAdapter implements LLMAdapter {
  readonly modelId: string;
  private script: MockLLMScriptStep[];
  private stepIndex: number = 0;

  constructor(script: MockLLMScriptStep[], modelId: string = "mock-llm") {
    this.script = script;
    this.modelId = modelId;
  }

  async chat(
    messages: LLMMessage[],
    tools: LLMTool[],
    config?: Partial<LLMAdapterConfig>
  ): Promise<LLMResponse> {
    if (this.stepIndex >= this.script.length) {
      // Return end_turn if we've run out of steps
      return {
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Task complete",
            },
          ],
        },
        stopReason: "end_turn",
      };
    }

    const step = this.script[this.stepIndex];
    this.stepIndex++;

    const toolCall = {
      id: `call_${this.stepIndex}`,
      name: step.toolName,
      input: step.toolInput,
    };

    return {
      message: {
        role: "assistant",
        content: [
          {
            type: "text",
            text: `Calling ${step.toolName}`,
          },
        ],
        toolCalls: [toolCall],
      },
      stopReason: step.stopReason || "tool_use",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
      },
    };
  }

  reset(): void {
    this.stepIndex = 0;
  }
}
