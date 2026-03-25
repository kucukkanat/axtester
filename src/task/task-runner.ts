import type {
  TaskOptions,
  TaskReport,
  CombinedReport,
  CorrelationItem,
} from "../task-types.ts";
import { BARRIER_TO_AUDIT_CATEGORY } from "./barrier-detector.ts";
import { scoreTask, generateTaskInsights } from "./scorer.ts";
import { BrowserController, type BrowserConfig } from "./browser.ts";
import { runAgentLoop } from "./agent-loop.ts";
import { runAudit } from "../runner.ts";

export async function runTask(
  url: string,
  options: TaskOptions
): Promise<TaskReport> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // Browser config
  const browserConfig: BrowserConfig = {
    viewport: options.viewport || { width: 1280, height: 720 },
    extraHeaders: options.extraHeaders,
    stealth: options.stealth,
  };

  // Create browser controller
  const browser = new BrowserController(browserConfig);

  try {
    // Launch browser
    await browser.launch();
    await browser.createPage();

    // Navigate to URL
    await browser.navigate(url, options.pageLoadTimeoutMs || 30000);

    // Run agent loop
    const loopResult = await runAgentLoop(browser, options.prompt, {
      maxSteps: options.maxSteps || 30,
      timeoutMs: options.timeoutMs || 120000,
      pageLoadTimeoutMs: options.pageLoadTimeoutMs || 30000,
      interactionTimeoutMs: options.interactionTimeoutMs || 10000,
      screenshotsEnabled: options.screenshotsEnabled !== false,
      llmAdapter: options.llmAdapter,
    });

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    // Score the task
    const score = scoreTask(loopResult.steps, loopResult.barriers, loopResult.finalStatus);

    // Generate insights
    const insights = generateTaskInsights(
      loopResult.barriers,
      loopResult.steps,
      loopResult.finalStatus
    );

    // Estimate cost
    const estimatedCostUsd =
      loopResult.totalInputTokens > 0 || loopResult.totalOutputTokens > 0
        ? estimateCost(
            options.llmAdapter.modelId,
            loopResult.totalInputTokens,
            loopResult.totalOutputTokens
          )
        : null;

    return {
      url,
      prompt: options.prompt,
      modelId: options.llmAdapter.modelId,
      startedAt,
      completedAt,
      durationMs,
      steps: loopResult.steps,
      totalSteps: loopResult.steps.length,
      barriersEncountered: loopResult.barriers,
      finalOutcome: loopResult.finalStatus,
      agentAnswer: loopResult.finalAnswer,
      totalInputTokens: loopResult.totalInputTokens,
      totalOutputTokens: loopResult.totalOutputTokens,
      estimatedCostUsd,
      score,
      agentReadinessInsights: insights,
    };
  } finally {
    // Cleanup
    await browser.close();
    await browser.closeBrowser();
  }
}

export async function runTaskWithAudit(
  url: string,
  options: TaskOptions
): Promise<CombinedReport> {
  const generatedAt = new Date().toISOString();

  // Run task execution
  const taskReport = await runTask(url, options);

  // Run static audit
  const staticAudit = await runAudit(url, {
    categories: undefined,
    fetchOptions: {
      timeoutMs: options.pageLoadTimeoutMs || 30000,
    },
  });

  // Generate correlations between barriers and audit findings
  const correlations: CorrelationItem[] = [];

  for (const barrier of taskReport.barriersEncountered) {
    const auditCategory = BARRIER_TO_AUDIT_CATEGORY[barrier.type];

    if (auditCategory) {
      // Find related findings in static audit
      const categoryScore = staticAudit.categories.find(
        (c) => c.category === auditCategory
      );

      if (categoryScore && categoryScore.findings.length > 0) {
        const topFinding = categoryScore.findings[0];
        correlations.push({
          barrierType: barrier.type,
          auditCategory,
          explanation: `${barrier.description} - Also found in static audit: ${topFinding.message}`,
        });
      } else {
        correlations.push({
          barrierType: barrier.type,
          auditCategory,
          explanation: `${barrier.description} - Not detected in static audit but identified during task execution`,
        });
      }
    }
  }

  return {
    url,
    generatedAt,
    staticAudit,
    taskExecution: taskReport,
    correlations,
  };
}

function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Pricing per 1M tokens (as of March 2025)
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-opus-4-5": { input: 15, output: 75 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5": { input: 0.8, output: 4 },
    "gpt-4": { input: 30, output: 60 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-4o": { input: 5, output: 15 },
  };

  const modelPricing = pricing[modelId] || pricing["gpt-4"];

  return (
    (inputTokens / 1000000) * modelPricing.input +
    (outputTokens / 1000000) * modelPricing.output
  );
}
