import type {
  AgentBarrier,
  AgentBarrierType,
  BrowserToolResult,
  TaskStep,
} from "../task-types.ts";

export const BARRIER_TO_AUDIT_CATEGORY: Record<
  AgentBarrierType,
  string | undefined
> = {
  captcha: "anti-agent-friction",
  "login-wall": "anti-agent-friction",
  "consent-wall": "anti-agent-friction",
  "rate-limit": "anti-agent-friction",
  "missing-label": "semantic-clarity",
  "no-accessible-element": "interaction-surface",
  "js-only": "structural-parsability",
  "navigation-timeout": "interaction-surface",
  "interaction-timeout": "interaction-surface",
  "loop-detected": "anti-agent-friction",
  unknown: undefined,
};

export function detectBarrier(
  stepIndex: number,
  toolName: string,
  toolResult: BrowserToolResult,
  url: string,
  error?: Error
): AgentBarrier | null {
  // Check for explicit failures in tool result
  if (!toolResult.success) {
    const errorMsg = toolResult.error?.toLowerCase() || "";

    if (
      errorMsg.includes("recaptcha") ||
      errorMsg.includes("captcha") ||
      errorMsg.includes("hcaptcha")
    ) {
      return {
        type: "captcha",
        stepIndex,
        description: "CAPTCHA detected - requires human verification",
        url,
        relatedAuditCategory: "anti-agent-friction",
      };
    }

    if (
      errorMsg.includes("401") ||
      errorMsg.includes("403") ||
      errorMsg.includes("login")
    ) {
      return {
        type: "login-wall",
        stepIndex,
        description: "Login wall encountered - authentication required",
        url,
        relatedAuditCategory: "anti-agent-friction",
      };
    }

    if (
      errorMsg.includes("429") ||
      errorMsg.includes("rate limit") ||
      errorMsg.includes("too many")
    ) {
      return {
        type: "rate-limit",
        stepIndex,
        description: "Rate limited - too many requests",
        url,
        relatedAuditCategory: "anti-agent-friction",
      };
    }

    if (errorMsg.includes("timeout")) {
      if (toolName === "navigate") {
        return {
          type: "navigation-timeout",
          stepIndex,
          description: "Page navigation timed out - page loads too slowly",
          url,
          relatedAuditCategory: "interaction-surface",
        };
      } else {
        return {
          type: "interaction-timeout",
          stepIndex,
          description: "Interaction timed out - element not found or not interactive",
          url,
          relatedAuditCategory: "interaction-surface",
        };
      }
    }

    if (
      errorMsg.includes("not found") ||
      errorMsg.includes("cannot find") ||
      errorMsg.includes("does not match")
    ) {
      return {
        type: "no-accessible-element",
        stepIndex,
        description: "Target element not found - may not be accessible to agents",
        url,
        relatedAuditCategory: "interaction-surface",
      };
    }

    if (errorMsg.includes("cookie") || errorMsg.includes("consent")) {
      return {
        type: "consent-wall",
        stepIndex,
        description: "Cookie consent wall - blocks interaction without consent",
        url,
        relatedAuditCategory: "anti-agent-friction",
      };
    }
  }

  // Check for find_elements with no results (missing label pattern)
  if (toolName === "find_elements" && toolResult.success) {
    const data = toolResult.data as { found?: number } | undefined;
    if (data && data.found === 0) {
      return {
        type: "missing-label",
        stepIndex,
        description: "Search query returned no accessible elements",
        url,
        relatedAuditCategory: "semantic-clarity",
      };
    }
  }

  // Check for JavaScript-only content errors
  if (error?.message?.includes("JavaScript") || error?.message?.includes("js-only")) {
    return {
      type: "js-only",
      stepIndex,
      description: "Content requires JavaScript execution",
      url,
      relatedAuditCategory: "structural-parsability",
    };
  }

  return null;
}

export function detectLoopBarrier(
  steps: TaskStep[],
  stepIndex: number,
  toolName: string,
  toolInput: Record<string, unknown>,
  url: string
): AgentBarrier | null {
  // Check if same tool with same input appears 3 times consecutively
  if (stepIndex < 2) {
    return null;
  }

  const recentSteps = steps.slice(Math.max(0, stepIndex - 2), stepIndex);

  const sameToolCount = recentSteps.filter(
    (s) => s.toolName === toolName && deepEqual(s.toolInput, toolInput)
  ).length;

  if (sameToolCount >= 2) {
    return {
      type: "loop-detected",
      stepIndex,
      description: "Agent is repeating the same action - likely stuck in a loop",
      url,
      relatedAuditCategory: "anti-agent-friction",
    };
  }

  return null;
}

export function shouldBlockOnBarrier(
  barrier: AgentBarrier,
  barrierCount: Record<AgentBarrierType, number>
): boolean {
  // Critical barriers that should block immediately
  const criticalTypes: AgentBarrierType[] = [
    "captcha",
    "login-wall",
    "rate-limit",
  ];

  if (criticalTypes.includes(barrier.type)) {
    // Block after encountering same critical barrier twice
    if ((barrierCount[barrier.type] || 0) >= 1) {
      return true;
    }
  }

  // Navigation timeouts: block after 3 in a row
  if (barrier.type === "navigation-timeout") {
    if ((barrierCount["navigation-timeout"] || 0) >= 2) {
      return true;
    }
  }

  return false;
}

function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (
    obj1 === null ||
    obj2 === null ||
    obj1 === undefined ||
    obj2 === undefined
  ) {
    return false;
  }

  if (typeof obj1 !== "object" || typeof obj2 !== "object") {
    return false;
  }

  const keys1 = Object.keys(obj1 as Record<string, unknown>);
  const keys2 = Object.keys(obj2 as Record<string, unknown>);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (
      !deepEqual(
        (obj1 as Record<string, unknown>)[key],
        (obj2 as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }

  return true;
}
