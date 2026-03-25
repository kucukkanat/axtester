import type { ParsedPage, AuditorModule, Finding } from "../types.ts";

export const temporal: AuditorModule = {
  category: "temporal-stability",
  weight: 0.08,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];
    const metadata: Record<string, unknown> = {};

    // Hashed Class Names
    const hashedRatio = detectHashedClassNames(page);
    metadata.hashedClassNameRatio = hashedRatio;
    if (hashedRatio > 0.2) {
      findings.push({
        id: "hashed-classes",
        severity: "warning",
        message: `${(hashedRatio * 100).toFixed(1)}% of classes appear to be hashed (CSS Modules, Tailwind JIT, etc.)`,
        detail:
          "Class names like css-abc123, __abcdef, or Tailwind JIT utilities detected",
        recommendation:
          "Use stable, semantic class names for elements agents depend on; avoid hash-based selectors",
      });
      score -= 15;
    }

    // A/B Testing Signals
    const abTestFindings = detectABTestingSignals(page);
    findings.push(...abTestFindings);
    metadata.abTestingDetected = abTestFindings.length > 0;
    abTestFindings.forEach(() => {
      score -= 12;
    });

    // Dynamic Rendering Signals
    const dynamicFindings = detectDynamicRenderingSignals(page);
    findings.push(...dynamicFindings);
    metadata.dynamicRenderingDetected = dynamicFindings.length > 0;
    dynamicFindings.forEach(() => {
      score -= 8;
    });

    // Selector Stability
    const stabilityScore = calculateSelectorStabilityScore(page);
    metadata.selectorStabilityScore = stabilityScore;
    if (stabilityScore < 0.3) {
      findings.push({
        id: "selector-instability",
        severity: "warning",
        message: "Low selector stability: many class-only selectors without stable IDs or data-*",
        detail: `Selector stability score: ${(stabilityScore * 100).toFixed(1)}%`,
        recommendation:
          "Use data-* attributes or stable IDs for interactive elements that agents depend on",
      });
      score -= 10;
    }

    // Longitudinal Data Note
    findings.push({
      id: "longitudinal-note",
      severity: "info",
      message:
        "Note: true temporal stability requires comparing multiple snapshots over time",
      detail:
        "This snapshot shows current state; actual stability trends need historical data",
      recommendation:
        "Monitor this page regularly to detect changes in structure and selectors",
    });
    metadata.requiresLongitudinalData = true;

    score = Math.max(0, Math.min(100, score));

    return {
      category: "temporal-stability",
      score,
      weight: 0.08,
      findings,
      metadata,
    };
  },
};

function detectHashedClassNames(page: ParsedPage): number {
  const html = page.fetch.html;

  // Patterns for hashed class names
  // CSS Modules: css-abc123 or __abcdef
  // Tailwind JIT: arbitrary values like bg-[#...]
  const classMatches = html.match(/class="([^"]+)"/g) || [];

  if (classMatches.length === 0) {
    return 0;
  }

  let hashedCount = 0;
  let totalClassNames = 0;

  for (const classAttr of classMatches) {
    const classes = classAttr
      .slice(7, -1)
      .split(/\s+/)
      .filter((c) => c.length > 0);

    totalClassNames += classes.length;

    for (const className of classes) {
      // CSS Modules pattern: word-hex
      if (/\w+-[a-z0-9]{5,8}$/i.test(className)) {
        hashedCount++;
      }
      // CSS Modules __hash
      else if (/__[a-z0-9]{6,}/i.test(className)) {
        hashedCount++;
      }
      // Tailwind JIT with arbitrary values
      else if (/\w+-\[/i.test(className)) {
        hashedCount++;
      }
    }
  }

  if (totalClassNames === 0) {
    return 0;
  }

  return hashedCount / totalClassNames;
}

function detectABTestingSignals(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const html = page.fetch.html.toLowerCase();

  // Optimizely
  if (
    html.includes("optimizely") ||
    html.includes("cdn.optimizely.com")
  ) {
    findings.push({
      id: "ab-testing-optimizely",
      severity: "warning",
      message: "Optimizely A/B testing platform detected",
      detail: "Page content may vary based on A/B test assignments",
      recommendation:
        "Be aware that page structure and content may change; monitor for variation",
    });
  }

  // Google Optimize
  if (html.includes("google-analytics") && html.includes("gtag")) {
    // This is a weak signal, but can indicate Google Optimize
    if (html.includes("optimize")) {
      findings.push({
        id: "ab-testing-google-optimize",
        severity: "warning",
        message: "Google Optimize A/B testing signals detected",
        detail: "Page may be running experiments via Google Analytics",
        recommendation:
          "Page variants may differ; ensure your agent handles variation",
      });
    }
  }

  // VWO
  if (html.includes("vwo") || html.includes("cdn.visualwebsiteoptimizer")) {
    findings.push({
      id: "ab-testing-vwo",
      severity: "warning",
      message: "VWO A/B testing platform detected",
      detail: "Page content may be modified by VWO experiments",
      recommendation:
        "Page layout and content may change; account for variation in agent logic",
    });
  }

  // LaunchDarkly
  if (html.includes("launchdarkly")) {
    findings.push({
      id: "feature-flags-launchdarkly",
      severity: "warning",
      message: "LaunchDarkly feature flag platform detected",
      detail: "Page features may be dynamically toggled based on feature flags",
      recommendation:
        "Features may appear/disappear; test your agent against different flag states",
    });
  }

  return findings;
}

function detectDynamicRenderingSignals(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const headers = page.fetch.headers;
  const html = page.fetch.html.toLowerCase();

  // Check for Vary: User-Agent
  if (headers["vary"]?.includes("User-Agent")) {
    findings.push({
      id: "dynamic-user-agent-based",
      severity: "warning",
      message: "Page response varies by User-Agent header",
      detail: "Different content may be returned for different user agents",
      recommendation:
        "Ensure your User-Agent header accurately represents your agent to receive correct content",
    });
  }

  // Check for meta fragment (Google's AJAX crawlable spec - deprecated but sometimes still used)
  if (html.includes('meta name="fragment"')) {
    findings.push({
      id: "dynamic-fragment-rendering",
      severity: "info",
      message: "Page uses fragment-based routing (AJAX crawlable spec)",
      detail: "Content may be loaded dynamically based on URL fragments",
    });
  }

  // Check for prerender service hints
  if (
    html.includes("rendertron") ||
    html.includes("prerender.io") ||
    html.includes("headless-chrome")
  ) {
    findings.push({
      id: "dynamic-prerender-service",
      severity: "info",
      message: "Prerender service hints detected",
      detail:
        "Page may use headless browser rendering for certain user agents",
    });
  }

  return findings;
}

function calculateSelectorStabilityScore(page: ParsedPage): number {
  const html = page.fetch.html;

  // Count stable selectors (IDs and data-* attributes)
  const idMatches = (html.match(/\bid=["']/g) || []).length;
  const dataAttrMatches = (html.match(/\bdata-[\w-]+=["']/g) || []).length;
  const stableSelectors = idMatches + dataAttrMatches;

  // Count class-only selectors (less stable)
  const classMatches = (html.match(/\bclass=["'][^"']*["']/g) || []).length;

  if (classMatches === 0 && stableSelectors === 0) {
    return 0.5; // Neutral if neither found
  }

  const totalInteractiveElements = classMatches + stableSelectors;
  if (totalInteractiveElements === 0) {
    return 1.0;
  }

  return stableSelectors / totalInteractiveElements;
}

export default temporal;
