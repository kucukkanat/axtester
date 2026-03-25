import type { ParsedPage, AuditorModule, Finding } from "../types.ts";

// Sonnet pricing: $3 per 1M input tokens
const SONNET_PRICE_PER_1M_TOKENS = 3.0;
const APPROX_CHARS_PER_TOKEN = 4; // GPT-style estimation

export const tokenEconomics: AuditorModule = {
  category: "token-economics",
  weight: 0.1,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];
    const metadata: Record<string, unknown> = {};

    // Raw HTML Token Estimate
    const rawHtmlTokens = estimateTokens(page.fetch.html);
    const rawHtmlCost =
      (rawHtmlTokens / 1_000_000) * SONNET_PRICE_PER_1M_TOKENS;
    metadata.rawHtmlTokens = rawHtmlTokens;
    metadata.rawHtmlCost = `$${rawHtmlCost.toFixed(6)}`;
    metadata.costPer1kTokens = `$${(SONNET_PRICE_PER_1M_TOKENS / 1000).toFixed(4)}`;

    // Markdown Token Estimate
    const markdownTokens = estimateTokens(page.markdownEstimate);
    const markdownCost =
      (markdownTokens / 1_000_000) * SONNET_PRICE_PER_1M_TOKENS;
    metadata.markdownTokens = markdownTokens;
    metadata.markdownCost = `$${markdownCost.toFixed(6)}`;

    // Content to Noise Ratio
    const contentRatio = page.markdownEstimate.length / page.fetch.html.length;
    metadata.contentToNoiseRatio = contentRatio;

    if (contentRatio < 0.05) {
      findings.push({
        id: "extreme-noise",
        severity: "critical",
        message: "Extreme content-to-noise ratio",
        detail: `Only ${(contentRatio * 100).toFixed(2)}% of HTML is actual content`,
        recommendation:
          "Significantly reduce HTML boilerplate, CSS, and navigation chrome",
      });
      score -= 30;
    } else if (contentRatio < 0.15) {
      findings.push({
        id: "high-noise",
        severity: "critical",
        message: `High content-to-noise ratio: ${(contentRatio * 100).toFixed(1)}%`,
        detail: "Most of the page is HTML boilerplate rather than content",
        recommendation:
          "Minimize HTML size; consider using CSS more efficiently or providing a content API",
      });
      score -= 25;
    } else if (contentRatio < 0.3) {
      findings.push({
        id: "moderate-noise",
        severity: "warning",
        message: `Moderate content-to-noise ratio: ${(contentRatio * 100).toFixed(1)}%`,
        detail:
          "A significant portion of the HTML consists of boilerplate (nav, ads, etc.)",
        recommendation:
          "Optimize HTML structure to reduce non-content markup",
      });
      score -= 12;
    } else {
      findings.push({
        id: "good-ratio",
        severity: "pass",
        message: `Good content-to-noise ratio: ${(contentRatio * 100).toFixed(1)}%`,
        detail: "Page has a healthy balance of content to markup",
      });
    }

    // Redundant Content Detection
    const redundancyScore = detectRedundantContent(page.markdownEstimate);
    metadata.redundancyScore = redundancyScore;
    if (redundancyScore > 0.2) {
      findings.push({
        id: "redundant-content",
        severity: "warning",
        message: `High content redundancy detected (${(redundancyScore * 100).toFixed(1)}%)`,
        detail: "Same content appears multiple times across the page",
        recommendation:
          "Avoid repeating headers, footers, and navigation across multiple copies",
      });
      score -= 10;
    }

    // Token Reduction Potential
    const hasJsonLd = page.root.querySelector(
      'script[type="application/ld+json"]'
    );
    if (hasJsonLd) {
      const savingsPercent = Math.round(
        ((rawHtmlTokens - markdownTokens) / rawHtmlTokens) * 100
      );
      metadata.tokenReductionWithApi = `${savingsPercent}%`;
      const savingsPer1k = Math.round(
        ((rawHtmlTokens - markdownTokens) * SONNET_PRICE_PER_1M_TOKENS) / 1_000
      );
      metadata.costSavingsPer1kVisits = `$${(savingsPer1k / 1000).toFixed(4)}`;

      findings.push({
        id: "api-already-present",
        severity: "pass",
        message: `JSON-LD already present; potential token savings: ${savingsPercent}%`,
        detail: `Using JSON API instead of HTML scraping could save ~${savingsPer1k}¢ per 1000 visits`,
      });
    } else {
      const estimatedApiTokens = Math.round(rawHtmlTokens * 0.15);
      const estimatedSavingsPercent = Math.round(
        ((rawHtmlTokens - estimatedApiTokens) / rawHtmlTokens) * 100
      );
      metadata.potentialTokenReduction = `${estimatedSavingsPercent}%`;
      const estimatedSavingsPer1k = Math.round(
        ((rawHtmlTokens - estimatedApiTokens) * SONNET_PRICE_PER_1M_TOKENS) / 1_000
      );
      metadata.potentialSavingsPer1kVisits = `$${(estimatedSavingsPer1k / 1000).toFixed(4)}`;

      findings.push({
        id: "api-opportunity",
        severity: "info",
        message: `Adding JSON API could reduce tokens by ~${estimatedSavingsPercent}%`,
        detail: `Potential savings: ~${estimatedSavingsPer1k}¢ per 1000 agent visits`,
        recommendation:
          "Provide a JSON API endpoint or add structured data (JSON-LD) for common queries",
      });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      category: "token-economics",
      score,
      weight: 0.1,
      findings,
      metadata,
    };
  },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function detectRedundantContent(text: string): number {
  // Split into words and look for repeated 5+ word phrases
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length < 10) {
    return 0;
  }

  const phraseCounts = new Map<string, number>();
  const phraseLength = 5;

  for (let i = 0; i < words.length - phraseLength + 1; i++) {
    const phrase = words.slice(i, i + phraseLength).join(" ");
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  }

  let redundantWords = 0;
  for (const [phrase, count] of phraseCounts.entries()) {
    if (count > 1) {
      // Count each extra occurrence
      redundantWords += (count - 1) * phraseLength;
    }
  }

  const redundancyRatio = redundantWords / words.length;
  return Math.min(redundancyRatio, 1.0);
}

export default tokenEconomics;
