import type { ParsedPage, AuditorModule, Finding } from "../types.ts";
import { HTMLElement } from "node-html-parser";

const SEMANTIC_TAGS = [
  "article",
  "main",
  "nav",
  "aside",
  "section",
  "header",
  "footer",
];
const GENERIC_LABELS = [
  "click here",
  "read more",
  "learn more",
  "more info",
  "more details",
  "see more",
  "find out more",
  "discover more",
];

export const semantic: AuditorModule = {
  category: "semantic-clarity",
  weight: 0.15,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];
    const metadata: Record<string, unknown> = {};

    // Semantic Tag Ratio
    const semanticRatio = calculateSemanticTagRatio(page);
    metadata.semanticTagRatio = semanticRatio;
    if (semanticRatio < 0.3) {
      findings.push({
        id: "low-semantic-ratio",
        severity: "warning",
        message: `Only ${(semanticRatio * 100).toFixed(1)}% of page uses semantic HTML tags`,
        detail: `Semantic tags found: ${(semanticRatio * 100).toFixed(1)}%`,
        recommendation:
          "Use semantic HTML elements (article, main, nav, aside, section, header, footer) instead of divs",
      });
      score -= 15;
    }

    // Heading Hierarchy
    const headingFindings = checkHeadingHierarchy(page);
    findings.push(...headingFindings);
    metadata.headingIssues = headingFindings.length;
    headingFindings.forEach((f) => {
      if (f.severity === "critical") score -= 25;
      else if (f.severity === "warning") score -= 15;
    });

    // Button and Link Labels
    const labelFindings = checkButtonLinkLabels(page);
    findings.push(...labelFindings);
    metadata.badLabelCount = labelFindings.length;
    labelFindings.forEach((f) => {
      if (f.severity === "critical") score -= 10;
      else score -= 5;
    });

    // Form Labels
    const formLabelFindings = checkFormLabels(page);
    findings.push(...formLabelFindings);
    metadata.unLabeledFormFields = formLabelFindings.filter(
      (f) => f.severity === "critical"
    ).length;
    formLabelFindings.forEach((f) => {
      if (f.severity === "critical") score -= 15;
      else score -= 5;
    });

    // ARIA Attributes
    const ariaRatio = calculateAriaRatio(page);
    metadata.ariaRatio = ariaRatio;
    if (ariaRatio < 0.1) {
      findings.push({
        id: "low-aria-coverage",
        severity: "info",
        message:
          "Limited use of ARIA attributes for enhanced accessibility hints",
        detail: `ARIA attribute coverage: ${(ariaRatio * 100).toFixed(1)}%`,
        recommendation:
          "Add aria-label, aria-labelledby, aria-live, and other ARIA attributes to complex interactive elements",
      });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      category: "semantic-clarity",
      score,
      weight: 0.15,
      findings,
      metadata,
    };
  },
};

function calculateSemanticTagRatio(page: ParsedPage): number {
  const allElements = page.root.querySelectorAll("*");
  if (allElements.length === 0) {
    return 0;
  }

  const semanticElements = SEMANTIC_TAGS.map((tag) =>
    page.root.querySelectorAll(tag)
  ).reduce((acc, arr) => acc.concat(arr as any[]), []);

  return semanticElements.length / allElements.length;
}

function checkHeadingHierarchy(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const headings = [];

  for (let i = 1; i <= 6; i++) {
    const elements = page.root.querySelectorAll(`h${i}`);
    headings.push(...elements.map((el) => ({ level: i, el })));
  }

  if (headings.length === 0) {
    findings.push({
      id: "no-headings",
      severity: "warning",
      message: "Page has no heading elements",
      detail: "No h1-h6 tags found",
      recommendation: "Add a proper heading hierarchy starting with h1",
    });
    return findings;
  }

  // Check for exactly one h1
  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count === 0) {
    findings.push({
      id: "no-h1",
      severity: "critical",
      message: "Page has no h1 element",
      detail: "Page must start with exactly one h1",
      recommendation: "Add a single h1 element as the main page title",
    });
  } else if (h1Count > 1) {
    findings.push({
      id: "multiple-h1",
      severity: "warning",
      message: `Page has ${h1Count} h1 elements (should be exactly 1)`,
      recommendation: "Use only one h1 per page",
    });
  }

  // Check for skipped levels
  let lastLevel = 0;
  for (const heading of headings) {
    if (heading.level > lastLevel + 1 && lastLevel > 0) {
      findings.push({
        id: "heading-level-skip",
        severity: "warning",
        message: `Heading hierarchy skip: h${lastLevel} → h${heading.level}`,
        detail: `Skipped heading level(s) between h${lastLevel} and h${heading.level}`,
        recommendation:
          "Maintain a linear heading hierarchy without skipping levels",
      });
    }
    lastLevel = heading.level;
  }

  return findings;
}

function checkButtonLinkLabels(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];

  // Check buttons
  const buttons = page.root.querySelectorAll("button");
  for (const button of buttons) {
    const text = button.textContent?.trim() || "";

    if (text === "") {
      findings.push({
        id: "button-empty-label",
        severity: "critical",
        message: "Button has no text label",
        detail: "Button element is empty or contains only whitespace",
        recommendation: "Add descriptive text to all buttons",
      });
    } else if (isGenericLabel(text)) {
      findings.push({
        id: "button-generic-label",
        severity: "warning",
        message: `Button has generic label: "${text}"`,
        detail: "Button text is too generic for agents to understand purpose",
        recommendation: 'Replace generic labels like "Click here" with descriptive text',
      });
    }
  }

  // Check links
  const links = page.root.querySelectorAll("a");
  for (const link of links) {
    const text = link.textContent?.trim() || "";

    if (text === "") {
      findings.push({
        id: "link-empty-label",
        severity: "critical",
        message: "Link has no text label",
        detail: "Link element is empty or contains only whitespace",
        recommendation: "Add descriptive text to all links",
      });
    } else if (isGenericLabel(text)) {
      findings.push({
        id: "link-generic-label",
        severity: "warning",
        message: `Link has generic label: "${text}"`,
        detail: "Link text is too generic for agents to understand destination",
        recommendation: 'Replace generic labels with descriptive anchor text',
      });
    }
  }

  return findings;
}

function checkFormLabels(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];

  const inputs = page.root.querySelectorAll(
    "input, select, textarea"
  );

  for (const input of inputs) {
    const id = input.getAttribute("id");
    const ariaLabel = input.getAttribute("aria-label");
    const ariaLabelledby = input.getAttribute("aria-labelledby");

    // Check for associated label
    let hasLabel = false;
    if (id) {
      const label = page.root.querySelector(`label[for="${id}"]`);
      if (label) {
        hasLabel = true;
      }
    }

    if (!hasLabel && !ariaLabel && !ariaLabelledby) {
      const tagName = input.tagName?.toLowerCase();
      const fieldType = input.getAttribute("type") || "text";

      findings.push({
        id: "form-field-missing-label",
        severity: "critical",
        message: `${tagName} field (type: ${fieldType}) is missing an accessible label`,
        detail:
          "Field has no <label>, aria-label, or aria-labelledby association",
        recommendation:
          "Add a <label for='id'>, aria-label, or aria-labelledby attribute",
      });
    }
  }

  return findings;
}

function calculateAriaRatio(page: ParsedPage): number {
  const allElements = page.root.querySelectorAll("*");
  if (allElements.length === 0) {
    return 0;
  }

  const ariaElements = allElements.filter((el) => {
    const attrs = el.attributes || {};
    return Object.keys(attrs).some(
      (key) => key.startsWith("aria-") || key === "role"
    );
  });

  return ariaElements.length / allElements.length;
}

function isGenericLabel(text: string): boolean {
  const lower = text.toLowerCase();
  return GENERIC_LABELS.some((label) => lower === label);
}

export default semantic;
