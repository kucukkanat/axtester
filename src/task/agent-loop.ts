import type {
  LLMMessage,
  LLMContent,
  LLMTextContent,
  LLMImageContent,
  LLMAdapter,
  TaskStep,
  AgentBarrier,
  StepStatus,
} from "../task-types.ts";
import { BrowserController } from "./browser.ts";
import { getBrowserTools, toolExecutors, type BrowserToolName } from "./tools.ts";
import {
  detectBarrier,
  detectLoopBarrier,
  shouldBlockOnBarrier,
} from "./barrier-detector.ts";

export interface AgentLoopConfig {
  maxSteps: number;
  timeoutMs: number;
  pageLoadTimeoutMs: number;
  interactionTimeoutMs: number;
  screenshotsEnabled: boolean;
  llmAdapter: LLMAdapter;
}

export interface AgentLoopResult {
  steps: TaskStep[];
  barriers: AgentBarrier[];
  finalAnswer: string | null;
  finalStatus: "completed" | "failed" | "partial" | "blocked";
  totalInputTokens: number;
  totalOutputTokens: number;
}

export async function runAgentLoop(
  browser: BrowserController,
  prompt: string,
  config: AgentLoopConfig
): Promise<AgentLoopResult> {
  const startTime = Date.now();
  const steps: TaskStep[] = [];
  const barriers: AgentBarrier[] = [];
  const barrierCount: Record<string, number> = {};

  const messages: LLMMessage[] = [];
  let finalAnswer: string | null = null;
  let finalStatus: "completed" | "failed" | "partial" | "blocked" = "partial";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // System prompt
  const systemPrompt = buildSystemPrompt(prompt);

  // Initial snapshot
  const initialSnapshot = await browser.captureSnapshot();

  for (let stepIndex = 0; stepIndex < config.maxSteps; stepIndex++) {
    const stepStartTime = Date.now();

    // Check timeout
    if (Date.now() - startTime > config.timeoutMs) {
      finalStatus = "partial";
      break;
    }

    // Capture current state
    const snapshot = await browser.captureSnapshot();

    // Build message for LLM with snapshot + screenshot
    const userContent: LLMContent[] = [
      {
        type: "text",
        text: buildSnapshotPrompt(snapshot, prompt, stepIndex),
      },
    ];

    if (config.screenshotsEnabled) {
      try {
        const screenshotBase64 = await browser.takeScreenshot();
        userContent.push({
          type: "image",
          data: screenshotBase64,
          mediaType: "image/png",
        } as LLMImageContent);
      } catch {
        // Screenshot failed, continue without it
      }
    }

    // Add user message
    messages.push({
      role: "user",
      content: userContent,
    });

    // Call LLM
    try {
      const response = await config.llmAdapter.chat(
        messages,
        getBrowserTools(),
        {
          systemPrompt,
        }
      );

      if (response.usage) {
        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;
      }

      // Add assistant response to messages
      messages.push(response.message);

      // Extract tool call
      const toolCall = response.message.toolCalls?.[0];

      if (!toolCall) {
        // No tool call, agent is done
        finalStatus = "completed";
        break;
      }

      const toolName = toolCall.name;
      const toolInput = toolCall.input;

      // Check for loop
      const loopBarrier = detectLoopBarrier(
        steps,
        stepIndex,
        toolName,
        toolInput,
        snapshot.url
      );

      if (loopBarrier) {
        barriers.push(loopBarrier);
        barrierCount[loopBarrier.type] = (barrierCount[loopBarrier.type] || 0) + 1;

        if (shouldBlockOnBarrier(loopBarrier, barrierCount)) {
          finalStatus = "blocked";
          break;
        }
      }

      // Execute tool
      const executor = toolExecutors[toolName as BrowserToolName];

      if (!executor) {
        // Unknown tool
        const step: TaskStep = {
          index: stepIndex,
          url: snapshot.url,
          toolName: toolName as BrowserToolName,
          toolInput,
          toolResult: {
            success: false,
            error: `Unknown tool: ${toolName}`,
          },
          status: "failed",
          durationMs: Date.now() - stepStartTime,
          tokensUsed: response.usage,
        };

        steps.push(step);

        // Add tool result to messages
        messages.push({
          role: "tool",
          content: [
            {
              type: "text",
              text: `Tool error: Unknown tool ${toolName}`,
            },
          ],
          toolCallId: toolCall.id,
        });

        continue;
      }

      let toolResult = await executor(browser, toolInput);
      let stepStatus: StepStatus = toolResult.success ? "success" : "failed";

      // Check if this is a done/fail call
      if (toolName === "done") {
        finalAnswer = toolResult.data?.answer as string || null;
        finalStatus = "completed";
        stepStatus = "success";
      } else if (toolName === "fail") {
        finalStatus = "failed";
        stepStatus = "barrier";

        if (
          toolResult.data &&
          typeof toolResult.data === "object" &&
          "barrierType" in toolResult.data
        ) {
          const barrierType = toolResult.data.barrierType as string;
          const barrier: AgentBarrier = {
            type: barrierType as any,
            stepIndex,
            description: toolResult.error || "Agent failed",
            url: snapshot.url,
          };

          barriers.push(barrier);
          barrierCount[barrierType] = (barrierCount[barrierType] || 0) + 1;
        }
      } else {
        // Check for barriers in tool result
        const barrier = detectBarrier(
          stepIndex,
          toolName,
          toolResult,
          snapshot.url
        );

        if (barrier) {
          barriers.push(barrier);
          barrierCount[barrier.type] = (barrierCount[barrier.type] || 0) + 1;
          stepStatus = "barrier";

          if (shouldBlockOnBarrier(barrier, barrierCount)) {
            finalStatus = "blocked";

            // Add tool result and break
            messages.push({
              role: "tool",
              content: [
                {
                  type: "text",
                  text: JSON.stringify(toolResult),
                },
              ],
              toolCallId: toolCall.id,
            });

            const step: TaskStep = {
              index: stepIndex,
              url: snapshot.url,
              toolName: toolName as BrowserToolName,
              toolInput,
              toolResult,
              status: stepStatus,
              durationMs: Date.now() - stepStartTime,
              tokensUsed: response.usage,
              barrier,
            };

            steps.push(step);
            break;
          }
        }
      }

      // Record step
      const step: TaskStep = {
        index: stepIndex,
        url: snapshot.url,
        toolName: toolName as BrowserToolName,
        toolInput,
        toolResult,
        status: stepStatus,
        durationMs: Date.now() - stepStartTime,
        tokensUsed: response.usage,
        barrier: barriers[barriers.length - 1] || undefined,
      };

      steps.push(step);

      // Add tool result to messages
      messages.push({
        role: "tool",
        content: [
          {
            type: "text",
            text: JSON.stringify(toolResult),
          },
        ],
        toolCallId: toolCall.id,
      });

      // Check termination
      if (finalStatus === "completed" || finalStatus === "failed") {
        break;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      const step: TaskStep = {
        index: stepIndex,
        url: snapshot.url,
        toolName: "fail" as BrowserToolName,
        toolInput: {},
        toolResult: {
          success: false,
          error: `LLM error: ${errorMsg}`,
        },
        status: "failed",
        durationMs: Date.now() - stepStartTime,
      };

      steps.push(step);

      finalStatus = "failed";
      break;
    }
  }

  return {
    steps,
    barriers,
    finalAnswer,
    finalStatus,
    totalInputTokens,
    totalOutputTokens,
  };
}

function buildSystemPrompt(userPrompt: string): string {
  return `You are an AI agent assistant helping to complete a task on a website. Your goal is to help accomplish the following task:

${userPrompt}

You have access to browser control tools to navigate and interact with the webpage. For each step:
1. Analyze the current page snapshot and screenshot
2. Identify the next action needed to progress toward the goal
3. Call the appropriate tool
4. When you have completed the task or found the answer, call the 'done' tool with your answer
5. If you encounter an insurmountable barrier, call the 'fail' tool

Important rules:
- Always call a tool - do not just analyze without acting
- Use the page snapshot to find element indices to interact with
- If you need to find something specific, use 'find_elements' to search
- Do not repeat the same tool call more than twice in a row
- Be efficient and minimize unnecessary steps`;
}

function buildSnapshotPrompt(
  snapshot: any,
  userPrompt: string,
  stepIndex: number
): string {
  const elementsList = snapshot.interactiveElements
    .map(
      (el: any, idx: number) =>
        `[${idx}] <${el.tag}${el.type ? ` type="${el.type}"` : ""}> ${el.text.substring(0, 50)}${el.href ? ` href="${el.href}"` : ""}`
    )
    .join("\n");

  return `Step ${stepIndex + 1}

Current URL: ${snapshot.url}
Page Title: ${snapshot.title}

Interactive Elements on Page:
${elementsList}

Visible Text (first 2000 chars):
${snapshot.visibleText.substring(0, 2000)}

Task: ${userPrompt}

What is your next action?`;
}
