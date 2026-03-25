import type {
  TaskStep,
  AgentBarrier,
  TaskOutcome,
  TaskScore,
} from "../task-types.ts";

/**
 * Score a task execution based on steps, barriers, and outcome
 */
export function scoreTask(
  steps: TaskStep[],
  barriers: AgentBarrier[],
  outcome: TaskOutcome
): TaskScore {
  // Completion rate: percentage of steps that succeeded
  const successfulSteps = steps.filter(
    (s) => s.status === "success" || s.status === "skipped"
  ).length;
  const completionRate = steps.length > 0
    ? Math.round((successfulSteps / steps.length) * 100)
    : 0;

  // Efficiency: penalize excessive steps
  // Baseline: 5 steps is optimal
  // Each step beyond 5 reduces efficiency
  let efficiency = 100;
  if (steps.length > 5) {
    const excessSteps = steps.length - 5;
    efficiency = Math.max(10, 100 - (excessSteps / 5) * 20);
  }
  efficiency = Math.round(efficiency);

  // Barrier penalty: deduct based on critical barriers encountered
  let barrierPenalty = 0;

  const criticalBarriers = barriers.filter((b) =>
    ["captcha", "login-wall", "rate-limit", "consent-wall"].includes(b.type)
  );

  const nonCriticalBarriers = barriers.filter(
    (b) => !["captcha", "login-wall", "rate-limit", "consent-wall"].includes(b.type)
  );

  barrierPenalty += criticalBarriers.length * 25;
  barrierPenalty += nonCriticalBarriers.length * 10;

  barrierPenalty = Math.min(100, barrierPenalty);

  // Outcome multiplier
  const outcomeMultiplier: Record<TaskOutcome, number> = {
    completed: 1.0,
    partial: 0.7,
    failed: 0.3,
    blocked: 0.1,
  };

  const multiplier = outcomeMultiplier[outcome];

  // Calculate overall score
  // - Completion rate (40%): how many steps succeeded
  // - Efficiency (30%): how few steps were needed
  // - Barrier resilience (30%): how few barriers were encountered
  const overall = Math.round(
    (completionRate * 0.4 +
      efficiency * 0.3 +
      (100 - barrierPenalty) * 0.3) *
      multiplier
  );

  return {
    completionRate,
    efficiency,
    barrierPenalty,
    overall: Math.max(0, Math.min(100, overall)),
  };
}

/**
 * Generate insights about agent readiness based on task execution
 */
export function generateTaskInsights(
  barriers: AgentBarrier[],
  steps: TaskStep[],
  outcome: TaskOutcome
): string[] {
  const insights: string[] = [];

  // Barrier-based insights
  const barrierTypes = new Set(barriers.map((b) => b.type));

  if (barrierTypes.has("captcha")) {
    insights.push(
      "🚨 CAPTCHA detection blocks autonomous agents - consider removing or adding a headless-friendly path"
    );
  }

  if (barrierTypes.has("login-wall")) {
    insights.push(
      "🔒 Login wall prevents unauthenticated agent access - provide public API or guest mode for agent integration"
    );
  }

  if (barrierTypes.has("consent-wall")) {
    insights.push(
      "⚠️  Consent wall requires interaction before content - use programmatic consent headers or auto-accept for bots"
    );
  }

  if (barrierTypes.has("rate-limit")) {
    insights.push(
      "🚦 Rate limiting detected - implement higher limits for well-behaved agent traffic or provide agent access tokens"
    );
  }

  if (barrierTypes.has("missing-label")) {
    insights.push(
      "🏷️  Some elements lack accessible labels - add aria-label, aria-labelledby, or semantic HTML labels"
    );
  }

  if (barrierTypes.has("no-accessible-element")) {
    insights.push(
      "🖱️  Some interactive elements are not accessible to agents - ensure all buttons/links have text labels or ARIA"
    );
  }

  if (barrierTypes.has("navigation-timeout")) {
    insights.push(
      "⏱️  Page loads slowly - optimize assets, lazy-load non-critical content, or provide faster navigation"
    );
  }

  if (barrierTypes.has("loop-detected")) {
    insights.push(
      "🔄 Agent got stuck in a loop - ensure error states are clearly indicated and navigation options are available"
    );
  }

  // Outcome-based insights
  if (outcome === "completed") {
    insights.push("✅ Agent successfully completed the task");
  } else if (outcome === "blocked") {
    insights.push(
      "❌ Agent was blocked by barriers - site may need agent-specific accommodations"
    );
  } else if (outcome === "failed") {
    insights.push(
      "❌ Agent failed to complete task - review error messages and page structure"
    );
  } else if (outcome === "partial") {
    insights.push(
      "⚠️  Agent partially completed task but ran out of time or steps - may need optimization"
    );
  }

  // Efficiency-based insights
  if (steps.length > 20) {
    insights.push(
      `📊 Task required ${steps.length} steps - consider simplifying navigation or improving discoverability`
    );
  }

  const failedSteps = steps.filter((s) => s.status === "failed").length;
  if (failedSteps > steps.length * 0.3) {
    insights.push(
      `❌ More than 30% of steps failed (${failedSteps}/${steps.length}) - improve element labeling and accessibility`
    );
  }

  return insights;
}
