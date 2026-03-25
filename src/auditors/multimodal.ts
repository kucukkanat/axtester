import type { ParsedPage, AuditorModule, Finding } from "../types.ts";

export const multimodal: AuditorModule = {
  category: "multimodal-readiness",
  weight: 0.1,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];
    const metadata: Record<string, unknown> = {};

    // Image Alt Text Coverage
    const altCoverageFindings = checkImageAltCoverage(page);
    findings.push(...altCoverageFindings);
    const imageAltRatio = calculateImageAltRatio(page);
    metadata.imageAltRatio = imageAltRatio;
    altCoverageFindings.forEach((f) => {
      if (f.severity === "critical") score -= 25;
      else if (f.severity === "warning") score -= 15;
    });

    // SVG Title Presence
    const svgFindings = checkSvgTitles(page);
    findings.push(...svgFindings);
    const svgTitleRatio = calculateSvgTitleRatio(page);
    metadata.svgTitleRatio = svgTitleRatio;
    svgFindings.forEach((f) => {
      if (f.severity === "warning") score -= 8;
    });

    // Icon-Only Buttons
    const iconButtonFindings = checkIconOnlyButtons(page);
    findings.push(...iconButtonFindings);
    metadata.iconOnlyButtonCount = iconButtonFindings.length;
    iconButtonFindings.forEach(() => {
      score -= 5;
    });

    // Contrast Signals
    const contrastFindings = checkContrastSignals(page);
    findings.push(...contrastFindings);
    metadata.contrastIssuesDetected = contrastFindings.length > 0;
    contrastFindings.forEach((f) => {
      if (f.severity === "warning") score -= 10;
      else score -= 5;
    });

    // Viewport Meta
    const viewportFindings = checkViewportMeta(page);
    findings.push(...viewportFindings);
    metadata.hasViewportMeta = viewportFindings.length === 0;
    if (viewportFindings.length > 0) {
      score -= 12;
    }

    // Focus Management
    const focusFindings = checkFocusManagement(page);
    findings.push(...focusFindings);
    metadata.tabbableElements = page.root.querySelectorAll(
      "a, button, input, select, textarea, [tabindex]"
    ).length;
    focusFindings.forEach((f) => {
      if (f.severity === "warning") score -= 8;
    });

    score = Math.max(0, Math.min(100, score));

    return {
      category: "multimodal-readiness",
      score,
      weight: 0.1,
      findings,
      metadata,
    };
  },
};

function calculateImageAltRatio(page: ParsedPage): number {
  const images = page.root.querySelectorAll("img");

  if (images.length === 0) {
    return 1.0; // No images = perfect ratio
  }

  const imagesWithAlt = Array.from(images).filter((img) => {
    const alt = img.getAttribute("alt");
    return alt && alt.trim() !== "";
  });

  return imagesWithAlt.length / images.length;
}

function checkImageAltCoverage(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const altRatio = calculateImageAltRatio(page);
  const images = page.root.querySelectorAll("img");
  const totalImages = images.length;

  if (totalImages === 0) {
    return findings;
  }

  if (altRatio < 0.5) {
    findings.push({
      id: "image-alt-coverage-critical",
      severity: "critical",
      message: `Only ${(altRatio * 100).toFixed(1)}% of images have alt text`,
      detail: `${totalImages - Math.round(altRatio * totalImages)} images missing alt text`,
      recommendation:
        "All images must have descriptive alt text for accessibility",
    });
  } else if (altRatio < 0.8) {
    findings.push({
      id: "image-alt-coverage-warning",
      severity: "warning",
      message: `${(altRatio * 100).toFixed(1)}% image alt coverage (recommended: 100%)`,
      detail: `${totalImages - Math.round(altRatio * totalImages)} images missing alt text`,
      recommendation: "Add alt text to all images for complete accessibility",
    });
  } else if (altRatio < 1.0) {
    findings.push({
      id: "image-alt-coverage-partial",
      severity: "info",
      message: `${(altRatio * 100).toFixed(1)}% image alt coverage`,
      detail: `${totalImages - Math.round(altRatio * totalImages)} image(s) missing alt text`,
    });
  } else {
    findings.push({
      id: "image-alt-coverage-full",
      severity: "pass",
      message: "All images have alt text",
      detail: `All ${totalImages} image(s) include descriptive alt text`,
    });
  }

  return findings;
}

function calculateSvgTitleRatio(page: ParsedPage): number {
  const svgs = page.root.querySelectorAll("svg");

  if (svgs.length === 0) {
    return 1.0; // No SVGs = perfect ratio
  }

  const svgsWithTitle = Array.from(svgs).filter((svg) => {
    return svg.querySelector("title") !== null;
  });

  return svgsWithTitle.length / svgs.length;
}

function checkSvgTitles(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const svgTitleRatio = calculateSvgTitleRatio(page);
  const svgs = page.root.querySelectorAll("svg");
  const totalSvgs = svgs.length;

  if (totalSvgs === 0) {
    return findings;
  }

  if (svgTitleRatio < 1.0) {
    findings.push({
      id: "svg-title-coverage",
      severity: "warning",
      message: `${(svgTitleRatio * 100).toFixed(1)}% of SVGs have title elements`,
      detail: `${totalSvgs - Math.round(svgTitleRatio * totalSvgs)} SVG(s) missing <title>`,
      recommendation:
        "Add <title> elements inside all SVG graphics for accessibility",
    });
  }

  return findings;
}

function checkIconOnlyButtons(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const buttons = page.root.querySelectorAll("button");

  for (const button of buttons) {
    const text = button.textContent?.trim() || "";

    // Check if button contains only icon (SVG or img) with no text
    const hasSvg = button.querySelector("svg") !== null;
    const hasImg = button.querySelector("img") !== null;
    const childCount = button.childNodes?.length || 0;

    if ((hasSvg || hasImg) && text === "") {
      findings.push({
        id: "icon-only-button",
        severity: "warning",
        message: "Button contains only an icon with no text label",
        detail:
          "Button functionality is unclear to non-visual agents and users",
        recommendation:
          "Add text label or aria-label to describe button purpose",
      });
    }
  }

  return findings;
}

function checkContrastSignals(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const elements = page.root.querySelectorAll("[style*='color']");

  // Simple heuristic: look for inline styles with potentially low contrast
  for (const el of elements) {
    const style = el.getAttribute("style") || "";

    // Very basic pattern matching for low contrast colors
    if (
      style.includes("color:") &&
      (style.includes("#ccc") ||
        style.includes("#ddd") ||
        style.includes("rgba(0,0,0,0.2)") ||
        style.includes("rgba(0,0,0,0.1)"))
    ) {
      findings.push({
        id: "low-contrast-signal",
        severity: "info",
        message: "Potential low contrast color detected in inline style",
        detail: `Element with style: ${style.slice(0, 50)}...`,
        recommendation:
          "Verify text contrast meets WCAG AA standards (4.5:1 for normal text)",
      });
      break; // Just report one instance
    }
  }

  return findings;
}

function checkViewportMeta(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const viewportMeta = page.root.querySelector(
    'meta[name="viewport"]'
  );

  if (!viewportMeta) {
    findings.push({
      id: "missing-viewport-meta",
      severity: "warning",
      message: 'Missing <meta name="viewport"> tag',
      detail:
        "Page does not specify viewport configuration for mobile/responsive design",
      recommendation:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    });
  }

  return findings;
}

function checkFocusManagement(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];

  // Check for tabindex="-1" usage (removing elements from tab order)
  const negativeTabindex = page.root.querySelectorAll("[tabindex='-1']");
  if (negativeTabindex.length > 5) {
    findings.push({
      id: "excessive-negative-tabindex",
      severity: "warning",
      message: `Found ${negativeTabindex.length} elements with tabindex="-1"`,
      detail:
        "Many elements removed from tab order; may reduce keyboard navigability",
      recommendation:
        "Use negative tabindex sparingly; ensure keyboard users can still access key functionality",
    });
  }

  // Check for interactive elements with non-standard tabindex
  const customTabindex = page.root.querySelectorAll(
    "div[tabindex], span[tabindex]"
  );
  if (customTabindex.length > 3) {
    findings.push({
      id: "custom-tabindex-elements",
      severity: "info",
      message: `Found ${customTabindex.length} non-button/input elements with tabindex`,
      detail:
        "Div or span elements given tabindex; ensure they have proper ARIA roles",
      recommendation:
        "Use semantic interactive elements (button, a) where possible; provide ARIA roles for custom elements",
    });
  }

  return findings;
}

export default multimodal;
