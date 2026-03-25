// Public API for axagent library

// Audit API
export { runAudit } from "./runner.ts";
export { fetchPage } from "./fetcher.ts";
export { parsePage } from "./parser.ts";

// Task Execution API
export { runTask, runTaskWithAudit } from "./task/task-runner.ts";
export { createAdapter, createAdapterFromEnv } from "./task/llm-adapter.ts";
export { BrowserController } from "./task/browser.ts";
export { getBrowserTools, toolExecutors } from "./task/tools.ts";
export { runAgentLoop } from "./task/agent-loop.ts";
export { scoreTask, generateTaskInsights } from "./task/scorer.ts";
export {
  detectBarrier,
  detectLoopBarrier,
  shouldBlockOnBarrier,
  BARRIER_TO_AUDIT_CATEGORY,
} from "./task/barrier-detector.ts";

// Stealth Mode API
export {
  getRandomDelay,
  getRandomUserAgent,
  getStealthLaunchArgs,
  applyPageStealth,
  setBrowserHeaders,
  spoofGeolocation,
  navigateWithStealth,
  clickWithStealth,
  scrollWithStealth,
  typeWithDelay,
  createStealthPage,
  DEFAULT_STEALTH_CONFIG,
} from "./stealth.ts";

// Types - Audit
export type {
  AuditReport,
  AuditCategory,
  CategoryScore,
  Finding,
  ParsedPage,
  FetchResult,
  FetchOptions,
  RunnerOptions,
  AuditorModule,
  AuditorFn,
  Score,
  Severity,
} from "./types.ts";

export { FetchError } from "./types.ts";

// Types - Task Execution
export type {
  LLMAdapter,
  LLMAdapterConfig,
  LLMMessage,
  LLMResponse,
  LLMTool,
  LLMToolCall,
  LLMContent,
  LLMTextContent,
  LLMImageContent,
  LLMRole,
  BrowserToolName,
  BrowserToolResult,
  AgentBarrier,
  AgentBarrierType,
  TaskStep,
  TaskReport,
  CombinedReport,
  TaskOptions,
  TaskScore,
  TaskOutcome,
  PageSnapshot,
  InteractiveElement,
  CorrelationItem,
} from "./task-types.ts";

// Types - Stealth Mode
export type { StealthConfig } from "./stealth.ts";

// Individual auditors (for advanced usage)
export { default as structuralAuditor } from "./auditors/structural.ts";
export { default as semanticAuditor } from "./auditors/semantic.ts";
export { default as interactionAuditor } from "./auditors/interaction.ts";
export { default as frictionAuditor } from "./auditors/friction.ts";
export { default as extractionAuditor } from "./auditors/extraction.ts";
export { default as tokenEconomicsAuditor } from "./auditors/token-economics.ts";
export { default as temporalAuditor } from "./auditors/temporal.ts";
export { default as multimodalAuditor } from "./auditors/multimodal.ts";
