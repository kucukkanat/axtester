import type { HTMLElement } from "node-html-parser";

export type Score = number; // 0-100

export type Severity = "critical" | "warning" | "info" | "pass";

export interface Finding {
  id: string;
  severity: Severity;
  message: string;
  detail?: string;
  recommendation?: string;
}

export type AuditCategory =
  | "structural-parsability"
  | "semantic-clarity"
  | "interaction-surface"
  | "anti-agent-friction"
  | "data-extraction-quality"
  | "token-economics"
  | "temporal-stability"
  | "multimodal-readiness";

export interface CategoryScore {
  category: AuditCategory;
  score: Score;
  weight: number;
  findings: Finding[];
  metadata: Record<string, unknown>;
}

export interface AuditReport {
  url: string;
  fetchedAt: string; // ISO 8601
  durationMs: number;
  overallScore: Score;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: CategoryScore[];
  summary: string;
}

export interface FetchResult {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  html: string;
  fetchDurationMs: number;
}

export interface ParsedPage {
  fetch: FetchResult;
  root: HTMLElement;
  textContent: string;
  markdownEstimate: string;
}

export type AuditorFn = (page: ParsedPage) => Promise<CategoryScore> | CategoryScore;

export interface AuditorModule {
  category: AuditCategory;
  weight: number;
  audit: AuditorFn;
}

export interface FetchOptions {
  timeoutMs?: number;
  userAgent?: string;
  followRedirects?: boolean;
  headers?: Record<string, string>;
}

export interface RunnerOptions {
  categories?: AuditCategory[];
  fetchOptions?: FetchOptions;
  includeMetadata?: boolean;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "FetchError";
  }
}
