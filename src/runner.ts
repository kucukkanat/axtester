import { fetchPage } from "./fetcher.ts";
import { parsePage } from "./parser.ts";
import type {
  AuditReport,
  AuditCategory,
  FetchOptions,
  RunnerOptions,
  AuditorModule,
} from "./types.ts";

import structural from "./auditors/structural.ts";
import semantic from "./auditors/semantic.ts";
import interaction from "./auditors/interaction.ts";
import friction from "./auditors/friction.ts";
import extraction from "./auditors/extraction.ts";
import tokenEconomics from "./auditors/token-economics.ts";
import temporal from "./auditors/temporal.ts";
import multimodal from "./auditors/multimodal.ts";

const ALL_AUDITORS: AuditorModule[] = [
  friction,
  structural,
  semantic,
  interaction,
  extraction,
  tokenEconomics,
  temporal,
  multimodal,
];

export async function runAudit(
  url: string,
  options?: RunnerOptions
): Promise<AuditReport> {
  const startTime = performance.now();

  // Fetch and parse the page
  const fetchResult = await fetchPage(url, options?.fetchOptions);
  const parsedPage = parsePage(fetchResult);

  // Determine which auditors to run
  const auditorsToRun = options?.categories
    ? ALL_AUDITORS.filter((a) => options.categories?.includes(a.category))
    : ALL_AUDITORS;

  // Run all auditors in parallel
  const categoryScores = await Promise.all(
    auditorsToRun.map((auditor) => auditor.audit(parsedPage))
  );

  // Calculate weighted overall score
  const totalWeight = categoryScores.reduce((sum, cs) => sum + cs.weight, 0);
  const overallScore =
    categoryScores.reduce((sum, cs) => sum + (cs.score * cs.weight) / totalWeight, 0);

  // Determine grade
  const grade = deriveGrade(overallScore);

  // Generate summary
  const summary = generateSummary(overallScore, grade, categoryScores);

  const durationMs = performance.now() - startTime;

  return {
    url: fetchResult.url,
    fetchedAt: new Date().toISOString(),
    durationMs: Math.round(durationMs),
    overallScore: Math.round(overallScore),
    grade,
    categories: categoryScores,
    summary,
  };
}

function deriveGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function generateSummary(
  overallScore: number,
  grade: string,
  categories: any[]
): string {
  const topIssue = findTopIssue(categories);
  const topStrength = findTopStrength(categories);

  let summary = `This website scored ${Math.round(overallScore)}/100 (grade: ${grade}) on AI agent readiness. `;

  if (grade === "A" || grade === "B") {
    summary += "The site is well-optimized for agent access with good semantic structure and minimal friction.";
  } else if (grade === "C") {
    summary += "The site has moderate barriers to agent access; improvements in structure or friction reduction would help.";
  } else {
    summary += "The site presents significant challenges for AI agent access, likely due to CAPTCHA, login walls, or poor content-to-noise ratios.";
  }

  if (topIssue) {
    summary += ` Top issue: ${topIssue.message}.`;
  }

  if (topStrength) {
    summary += ` Strength: ${topStrength.message}.`;
  }

  return summary;
}

function findTopIssue(categories: any[]): any | null {
  for (const category of categories) {
    const criticalFindings = category.findings.filter(
      (f: any) => f.severity === "critical"
    );
    if (criticalFindings.length > 0) {
      return criticalFindings[0];
    }
  }

  for (const category of categories) {
    const warningFindings = category.findings.filter(
      (f: any) => f.severity === "warning"
    );
    if (warningFindings.length > 0) {
      return warningFindings[0];
    }
  }

  return null;
}

function findTopStrength(categories: any[]): any | null {
  for (const category of categories) {
    const passFindings = category.findings.filter(
      (f: any) => f.severity === "pass"
    );
    if (passFindings.length > 0) {
      return passFindings[0];
    }
  }

  return null;
}
