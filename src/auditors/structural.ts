import type { ParsedPage, AuditorModule, Finding } from "../types.ts";
import { HTMLElement } from "node-html-parser";

export const structural: AuditorModule = {
  category: "structural-parsability",
  weight: 0.15,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];
    const metadata: Record<string, unknown> = {};

    // DOM Depth
    const domDepth = calculateDOMDepth(page.root);
    metadata.domDepth = domDepth;
    if (domDepth > 15) {
      findings.push({
        id: "dom-depth-exceeded",
        severity: "warning",
        message: `DOM nesting depth is ${domDepth} (recommended: ≤15)`,
        detail: `Maximum nesting depth: ${domDepth}`,
        recommendation:
          "Flatten the DOM structure; deep nesting can make content hard to parse",
      });
      score -= 15;
    }

    // Content to Chrome Ratio
    const contentRatio = calculateContentRatio(page);
    metadata.contentToNoiseRatio = contentRatio;
    if (contentRatio < 0.3) {
      findings.push({
        id: "low-content-ratio",
        severity:
          contentRatio < 0.15 ? "critical" : "warning",
        message: `Content ratio is ${(contentRatio * 100).toFixed(1)}% (recommended: ≥30%)`,
        detail: `Only ${(contentRatio * 100).toFixed(1)}% of page text is actual content`,
        recommendation:
          "Reduce navigation chrome, headers, and footers relative to main content",
      });
      score -= contentRatio < 0.15 ? 25 : 15;
    }

    // Client-Side Rendering Risk
    const csrRisk = detectClientSideRenderingRisk(page);
    metadata.clientSideRenderingRisk = csrRisk.risk;
    if (csrRisk.risk) {
      findings.push({
        id: "client-side-rendering-risk",
        severity: "warning",
        message: "Page appears to be a Single Page Application (SPA)",
        detail:
          "Found minimal body content with #root or #app div; content likely rendered by JavaScript",
        recommendation:
          "Use server-side rendering (SSR), provide a headless API, or implement a static content variant",
      });
      score -= 15;
    }

    // Text in Images
    const imageFindings = checkTextInImages(page);
    findings.push(...imageFindings);
    metadata.imagesWithoutAlt = imageFindings.filter(
      (f) => f.id === "image-missing-alt"
    ).length;
    imageFindings.forEach(() => {
      score -= 5;
    });

    // SVG without Title
    const svgFindings = checkSvgAccessibility(page);
    findings.push(...svgFindings);
    metadata.svgWithoutTitle = svgFindings.length;
    svgFindings.forEach(() => {
      score -= 3;
    });

    // Canvas elements
    const canvasElements = page.root.querySelectorAll("canvas");
    metadata.canvasCount = canvasElements.length;
    if (canvasElements.length > 0) {
      findings.push({
        id: "canvas-content",
        severity: "warning",
        message: `Found ${canvasElements.length} canvas element(s)`,
        detail: "Canvas content is not accessible to static analysis",
        recommendation:
          "Provide alternative text content or data descriptions for canvas elements",
      });
      score -= Math.min(canvasElements.length * 5, 15);
    }

    // Iframe count
    const iframes = page.root.querySelectorAll("iframe");
    metadata.iframeCount = iframes.length;
    if (iframes.length > 2) {
      findings.push({
        id: "excessive-iframes",
        severity: "info",
        message: `Page contains ${iframes.length} iframe(s)`,
        detail: "Content within iframes is not directly accessible",
      });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      category: "structural-parsability",
      score,
      weight: 0.15,
      findings,
      metadata,
    };
  },
};

function calculateDOMDepth(node: HTMLElement, depth = 0): number {
  if (!node.childNodes) {
    return depth;
  }

  let maxDepth = depth;

  for (const child of node.childNodes) {
    if (child instanceof HTMLElement) {
      const childDepth = calculateDOMDepth(child, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }

  return maxDepth;
}

function calculateContentRatio(page: ParsedPage): number {
  const totalText = page.root.textContent || "";
  const cleanText = page.textContent || "";

  if (totalText.length === 0) {
    return 0;
  }

  // Content ratio is based on meaningful text vs all text
  return cleanText.length / totalText.length;
}

function detectClientSideRenderingRisk(page: ParsedPage): { risk: boolean } {
  const bodyElement = page.root.querySelector("body");

  if (!bodyElement) {
    return { risk: false };
  }

  // Check if body has minimal direct children (mostly scripts)
  const children = bodyElement.childNodes.filter(
    (node) => node instanceof HTMLElement
  );

  const scriptCount = children.filter(
    (node) => node instanceof HTMLElement && node.tagName?.toLowerCase() === "script"
  ).length;

  const nonScriptCount = children.length - scriptCount;

  // Check for #root or #app div
  const hasRootDiv = children.some(
    (node) =>
      node instanceof HTMLElement &&
      (node.id === "root" ||
        node.id === "app" ||
        node.getAttribute("id")?.includes("root") ||
        node.getAttribute("id")?.includes("app"))
  );

  // Risk if: mostly scripts and has root div, or very few elements
  const risk = hasRootDiv && nonScriptCount < 5;

  return { risk };
}

function checkTextInImages(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const images = page.root.querySelectorAll("img");

  for (const img of images) {
    const alt = img.getAttribute("alt");
    if (!alt || alt.trim() === "") {
      findings.push({
        id: "image-missing-alt",
        severity: "info",
        message: "Image missing alt text",
        detail: `Image: ${img.getAttribute("src") || "unknown"}`,
        recommendation: "Add descriptive alt text to all images",
      });
    }
  }

  return findings;
}

function checkSvgAccessibility(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const svgs = page.root.querySelectorAll("svg");

  for (const svg of svgs) {
    const title = svg.querySelector("title");
    if (!title) {
      findings.push({
        id: "svg-missing-title",
        severity: "info",
        message: "SVG missing title element",
        detail: "Inline SVG without descriptive title",
        recommendation:
          "Add a <title> element inside each SVG for accessibility",
      });
    }
  }

  return findings;
}

export default structural;
