import type { ParsedPage, AuditorModule, Finding } from "../types.ts";
import { HTMLElement } from "node-html-parser";

const CTA_KEYWORDS = [
  "submit",
  "buy",
  "purchase",
  "sign up",
  "signup",
  "register",
  "checkout",
  "book",
  "reserve",
  "subscribe",
  "join",
  "download",
];

export const interaction: AuditorModule = {
  category: "interaction-surface",
  weight: 0.12,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];
    const metadata: Record<string, unknown> = {};

    // Form Field Types
    const formFindings = checkFormFieldTypes(page);
    findings.push(...formFindings);
    metadata.formCount = countForms(page);
    metadata.typedInputRatio = calculateTypedInputRatio(page);
    formFindings.forEach(() => {
      score -= 3;
    });

    // Machine Readable State Signals
    const stateFindings = checkMachineReadableStates(page);
    findings.push(...stateFindings);
    metadata.ariaLiveElements = page.root.querySelectorAll(
      "[aria-live]"
    ).length;
    metadata.alertRoles = page.root.querySelectorAll('[role="alert"]').length;
    stateFindings.forEach((f) => {
      if (f.severity === "warning") score -= 10;
      else if (f.severity === "info") score -= 3;
    });

    // Modal Accessibility
    const modalFindings = checkModalAccessibility(page);
    findings.push(...modalFindings);
    metadata.modalsCount = page.root.querySelectorAll(
      '[role="dialog"], .modal, [data-modal]'
    ).length;
    modalFindings.forEach((f) => {
      if (f.severity === "warning") score -= 10;
    });

    // Dropdown Accessibility
    const dropdownFindings = checkDropdownAccessibility(page);
    findings.push(...dropdownFindings);
    metadata.selectCount = page.root.querySelectorAll("select").length;
    metadata.customListboxCount = page.root.querySelectorAll(
      '[role="listbox"]'
    ).length;
    dropdownFindings.forEach((f) => {
      if (f.severity === "warning") score -= 8;
    });

    // Key Action Depth
    const ctaCount = detectCallToActionButtons(page);
    metadata.keyActionCount = ctaCount;
    if (ctaCount === 0) {
      findings.push({
        id: "no-key-actions",
        severity: "info",
        message: "No obvious call-to-action buttons detected",
        detail: "Could not identify primary action buttons",
      });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      category: "interaction-surface",
      score,
      weight: 0.12,
      findings,
      metadata,
    };
  },
};

function checkFormFieldTypes(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const inputs = page.root.querySelectorAll("input");

  const unTypedInputs = inputs.filter((input) => {
    const type = input.getAttribute("type") || "text";
    return type === "text";
  });

  if (unTypedInputs.length > inputs.length * 0.5) {
    findings.push({
      id: "form-untyped-inputs",
      severity: "info",
      message: `${unTypedInputs.length} form fields use generic type="text"`,
      detail: `${((unTypedInputs.length / inputs.length) * 100).toFixed(1)}% of inputs lack semantic type`,
      recommendation:
        'Use semantic input types like type="email", type="tel", type="url", type="number", etc.',
    });
  }

  return findings;
}

function checkMachineReadableStates(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const forms = page.root.querySelectorAll("form");

  if (forms.length === 0) {
    return findings;
  }

  // Check if forms have error/success feedback mechanisms
  const formsWithoutStateIndicators = forms.filter((form) => {
    const hasAriaLive = form.querySelector("[aria-live]");
    const hasAlert = form.querySelector('[role="alert"]');
    const hasAriaInvalid = form.querySelector("[aria-invalid]");
    return !hasAriaLive && !hasAlert && !hasAriaInvalid;
  });

  if (formsWithoutStateIndicators.length > 0) {
    findings.push({
      id: "form-no-state-feedback",
      severity: "warning",
      message: `${formsWithoutStateIndicators.length} form(s) lack machine-readable state feedback`,
      detail:
        "Forms have no aria-live, role='alert', or aria-invalid attributes for error/success states",
      recommendation:
        "Add aria-live='polite' containers with role='alert' for form validation messages",
    });
  }

  return findings;
}

function checkModalAccessibility(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const modals = page.root.querySelectorAll('[role="dialog"]');

  for (const modal of modals) {
    const hasLabel = modal.getAttribute("aria-labelledby")
      || modal.getAttribute("aria-label");
    const isModal = modal.getAttribute("aria-modal") === "true";

    if (!hasLabel) {
      findings.push({
        id: "modal-no-label",
        severity: "warning",
        message: "Modal dialog missing aria-labelledby or aria-label",
        detail: "Dialog role found without accessible name",
        recommendation:
          "Add aria-labelledby pointing to a heading, or aria-label with description",
      });
    }

    if (!isModal) {
      findings.push({
        id: "modal-missing-aria-modal",
        severity: "info",
        message: "Modal missing aria-modal='true' attribute",
        detail: "Dialog has role but no aria-modal indicator",
      });
    }
  }

  return findings;
}

function checkDropdownAccessibility(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];

  // Check native selects (good)
  const selects = page.root.querySelectorAll("select");
  const selectCount = selects.length;

  // Check custom listboxes (risky)
  const listboxes = page.root.querySelectorAll('[role="listbox"]');

  for (const listbox of listboxes) {
    const expandedAttr = listbox.getAttribute("aria-expanded");
    const activeDescAttr = listbox.getAttribute("aria-activedescendant");
    const hasExpandedAttr = expandedAttr !== null && expandedAttr !== undefined;
    const hasActiveDesc = activeDescAttr !== null && activeDescAttr !== undefined;

    if (!hasExpandedAttr && !hasActiveDesc) {
      findings.push({
        id: "custom-listbox-no-aria",
        severity: "warning",
        message: "Custom listbox missing ARIA attributes",
        detail:
          "Custom role='listbox' element lacks aria-expanded and aria-activedescendant",
        recommendation:
          "Use native <select> elements, or implement full ARIA listbox pattern with aria-expanded and aria-activedescendant",
      });
    }
  }

  return findings;
}

function countForms(page: ParsedPage): number {
  return page.root.querySelectorAll("form").length;
}

function calculateTypedInputRatio(page: ParsedPage): number {
  const inputs = page.root.querySelectorAll("input");
  if (inputs.length === 0) {
    return 1.0;
  }

  const typedInputs = inputs.filter((input) => {
    const type = input.getAttribute("type") || "text";
    return type !== "text" && type !== "";
  });

  return typedInputs.length / inputs.length;
}

function detectCallToActionButtons(page: ParsedPage): number {
  const buttons = page.root.querySelectorAll("button");
  let ctaCount = 0;

  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || "";
    const type = button.getAttribute("type");

    if (type === "submit") {
      ctaCount++;
    } else if (CTA_KEYWORDS.some((keyword) => text.includes(keyword))) {
      ctaCount++;
    }
  }

  return ctaCount;
}

export default interaction;
