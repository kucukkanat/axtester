import type { AuditReport } from "./types.ts";
import type { StealthConfig } from "./stealth.ts";

// ============================================================================
// LLM Adapter Layer
// ============================================================================

export type LLMRole = "system" | "user" | "assistant" | "tool";

export interface LLMTextContent {
  type: "text";
  text: string;
}

export interface LLMImageContent {
  type: "image";
  data: string; // base64
  mediaType: "image/png" | "image/jpeg" | "image/webp";
}

export type LLMContent = LLMTextContent | LLMImageContent;

export interface LLMMessage {
  role: LLMRole;
  content: LLMContent[];
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, LLMToolParameter>;
    required?: string[];
  };
}

export interface LLMToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, LLMToolParameter>;
  required?: string[];
  items?: LLMToolParameter;
}

export interface LLMResponse {
  message: LLMMessage;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: "tool_use" | "end_turn" | "max_tokens" | "stop_sequence";
}

export interface LLMAdapterConfig {
  model: string;
  apiKey?: string; // optional for opencode (uses local instance)
  providerId?: string; // optional, defaults to "anthropic" for opencode
  baseUrl?: string;
  maxTokens?: number; // default 4096
  temperature?: number; // default 0
  systemPrompt?: string;
}

export interface LLMAdapter {
  readonly modelId: string;
  chat(
    messages: LLMMessage[],
    tools: LLMTool[],
    config?: Partial<LLMAdapterConfig>
  ): Promise<LLMResponse>;
}

// ============================================================================
// Browser Tools
// ============================================================================

export type BrowserToolName =
  | "navigate"
  | "click"
  | "type"
  | "scroll"
  | "select"
  | "extract_text"
  | "find_elements"
  | "screenshot"
  | "wait"
  | "done"
  | "fail";

export interface BrowserToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshotBase64?: string;
}

// ============================================================================
// Barriers
// ============================================================================

export type AgentBarrierType =
  | "captcha"
  | "login-wall"
  | "consent-wall"
  | "rate-limit"
  | "missing-label"
  | "no-accessible-element"
  | "js-only"
  | "navigation-timeout"
  | "interaction-timeout"
  | "loop-detected"
  | "unknown";

export interface AgentBarrier {
  type: AgentBarrierType;
  stepIndex: number;
  description: string;
  relatedAuditCategory?:
    | "anti-agent-friction"
    | "interaction-surface"
    | "semantic-clarity"
    | "structural-parsability";
  url: string;
  screenshotBase64?: string;
}

// ============================================================================
// Steps
// ============================================================================

export type StepStatus = "success" | "failed" | "skipped" | "barrier";

export interface TaskStep {
  index: number;
  url: string;
  toolName: BrowserToolName;
  toolInput: Record<string, unknown>;
  toolResult: BrowserToolResult;
  status: StepStatus;
  agentReasoning?: string;
  durationMs: number;
  tokensUsed?: {
    inputTokens: number;
    outputTokens: number;
  };
  barrier?: AgentBarrier;
}

// ============================================================================
// Page Snapshot
// ============================================================================

export interface InteractiveElement {
  index: number;
  tag: string;
  text: string;
  type?: string;
  value?: string;
  disabled: boolean;
  href?: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  interactiveElements: InteractiveElement[];
  visibleText: string; // first 2000 chars of body text
}

// ============================================================================
// Task Report
// ============================================================================

export type TaskOutcome = "completed" | "partial" | "failed" | "blocked";

export interface TaskScore {
  completionRate: number;
  efficiency: number;
  barrierPenalty: number;
  overall: number;
}

export interface TaskReport {
  url: string;
  prompt: string;
  modelId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: TaskStep[];
  totalSteps: number;
  barriersEncountered: AgentBarrier[];
  finalOutcome: TaskOutcome;
  agentAnswer: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number | null;
  score: TaskScore;
  agentReadinessInsights: string[];
}

// ============================================================================
// Combined Report
// ============================================================================

export interface CorrelationItem {
  barrierType: AgentBarrierType;
  auditCategory: string;
  explanation: string;
}

export interface CombinedReport {
  url: string;
  generatedAt: string;
  staticAudit: AuditReport;
  taskExecution: TaskReport;
  correlations: CorrelationItem[];
}

// ============================================================================
// Task Options
// ============================================================================

export interface TaskOptions {
  prompt: string;
  maxSteps?: number; // default: 30
  timeoutMs?: number; // default: 120_000
  pageLoadTimeoutMs?: number; // default: 30_000
  interactionTimeoutMs?: number; // default: 10_000
  screenshotsEnabled?: boolean; // default: true
  screenshotDir?: string;
  llmAdapter: LLMAdapter;
  includeStaticAudit?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  extraHeaders?: Record<string, string>;
  stealth?: StealthConfig; // Anti-bot detection evasion
}
