import type { ParsedPage, AuditorModule, Finding } from "../types.ts";

export const friction: AuditorModule = {
  category: "anti-agent-friction",
  weight: 0.18,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];

    // CAPTCHA Detection
    const captchaFindings = detectCaptcha(page);
    findings.push(...captchaFindings);
    captchaFindings.forEach((f) => {
      if (f.severity === "critical") score -= 35;
      else if (f.severity === "warning") score -= 15;
    });

    // Bot Fingerprinting Headers
    const wafFindings = detectWAFHeaders(page);
    findings.push(...wafFindings);
    wafFindings.forEach((f) => {
      if (f.severity === "critical") score -= 25;
      else if (f.severity === "warning") score -= 15;
    });

    // Cookie Consent Wall
    const consentFindings = detectConsentWall(page);
    findings.push(...consentFindings);
    consentFindings.forEach((f) => {
      if (f.severity === "critical") score -= 25;
      else if (f.severity === "warning") score -= 15;
    });

    // Login Wall
    const loginFindings = detectLoginWall(page);
    findings.push(...loginFindings);
    loginFindings.forEach((f) => {
      if (f.severity === "critical") score -= 30;
      else if (f.severity === "warning") score -= 15;
    });

    // User Agent Filtering
    const uaFindings = detectUserAgentFiltering(page);
    findings.push(...uaFindings);
    uaFindings.forEach((f) => {
      if (f.severity === "critical") score -= 20;
      else if (f.severity === "warning") score -= 10;
    });

    score = Math.max(0, Math.min(100, score));

    return {
      category: "anti-agent-friction",
      score,
      weight: 0.18,
      findings,
      metadata: {
        hasCaptcha: captchaFindings.length > 0,
        hasWAF: wafFindings.length > 0,
        hasConsentWall: consentFindings.length > 0,
        hasLoginWall: loginFindings.length > 0,
        userAgentFiltered: uaFindings.length > 0,
      },
    };
  },
};

function detectCaptcha(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const html = page.fetch.html.toLowerCase();

  // Check for reCAPTCHA
  if (
    html.includes("google.com/recaptcha") ||
    html.includes("recaptcha") ||
    html.includes("g-recaptcha")
  ) {
    findings.push({
      id: "captcha-recaptcha",
      severity: "critical",
      message: "reCAPTCHA detected",
      detail: "Found reCAPTCHA iframe or script",
      recommendation:
        "Consider implementing a JSON API or providing a direct backend endpoint for agent access",
    });
  }

  // Check for hCaptcha
  if (html.includes("hcaptcha") || html.includes("h-captcha")) {
    findings.push({
      id: "captcha-hcaptcha",
      severity: "critical",
      message: "hCaptcha detected",
      detail: "Found hCaptcha iframe or script",
      recommendation:
        "Provide alternative authentication methods for automated tools",
    });
  }

  // Check for Cloudflare Turnstile
  if (
    html.includes("challenges.cloudflare.com/turnstile") ||
    html.includes("cf-turnstile")
  ) {
    findings.push({
      id: "captcha-cloudflare-turnstile",
      severity: "critical",
      message: "Cloudflare Turnstile CAPTCHA detected",
      detail: "Found Cloudflare Turnstile challenge",
      recommendation:
        "Configure Cloudflare to allow verified bot traffic or provide API access",
    });
  }

  return findings;
}

function detectWAFHeaders(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const headers = page.fetch.headers;

  // Cloudflare
  if (headers["cf-ray"]) {
    findings.push({
      id: "waf-cloudflare",
      severity: "warning",
      message: "Cloudflare WAF detected",
      detail: `cf-ray header: ${headers["cf-ray"]}`,
      recommendation:
        "Ensure your User-Agent is recognized and not blocked by Cloudflare rules",
    });
  }

  // Akamai
  const akamaiHeaders = Object.keys(headers).filter((key) =>
    key.startsWith("x-akamai-")
  );
  if (akamaiHeaders.length > 0) {
    findings.push({
      id: "waf-akamai",
      severity: "warning",
      message: "Akamai WAF detected",
      detail: `Found Akamai headers: ${akamaiHeaders.join(", ")}`,
      recommendation:
        "Akamai may block traffic; adjust request patterns and headers",
    });
  }

  // Imperva/Sucuri
  if (headers["x-sucuri-id"] || headers["x-sucuri-cache"]) {
    findings.push({
      id: "waf-imperva",
      severity: "warning",
      message: "Imperva/Sucuri WAF detected",
      detail: "Found Imperva WAF headers",
      recommendation:
        "Imperva has aggressive bot filtering; verify your request patterns",
    });
  }

  // Generic WAF indicators
  if (headers["x-cdn"] || headers["via"]) {
    const via = headers["via"]?.toLowerCase() || "";
    if (via.includes("imperva") || headers["x-cdn"]?.includes("Imperva")) {
      findings.push({
        id: "waf-generic",
        severity: "info",
        message: "Generic WAF indicators detected",
        detail: "Traffic may be going through a WAF provider",
      });
    }
  }

  return findings;
}

function detectConsentWall(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const html = page.fetch.html.toLowerCase();
  const root = page.root;

  // OneTrust/CookiePro
  if (
    html.includes("onetrust") ||
    html.includes("cookiepro") ||
    root.querySelector("#onetrust-banner-sdk") ||
    root.querySelector("[data-cookiebanner]")
  ) {
    findings.push({
      id: "consent-wall-oneyrust",
      severity: "warning",
      message: "Cookie consent wall detected (OneTrust/CookiePro)",
      detail:
        "Found OneTrust or CookiePro banner that may block content access",
      recommendation:
        "Provide a cookie consent API or bypass mechanism for legitimate automated tools",
    });
  }

  // Generic consent banner patterns
  if (
    html.includes("consent") &&
    (html.includes("accept all") || html.includes("accept cookies"))
  ) {
    const consentElements = root.querySelectorAll(
      '[id*="consent"], [id*="cookie"], [class*="consent"], [class*="cookie"]'
    );
    if (
      consentElements.length > 0 &&
      consentElements.some((el) => {
        const style = el.getAttribute("style") || "";
        return style.includes("position") && (style.includes("fixed") || style.includes("sticky"));
      })
    ) {
      findings.push({
        id: "consent-wall-generic",
        severity: "warning",
        message: "Generic consent banner detected",
        detail: "Found fixed/sticky positioned consent banner",
        recommendation:
          "Ensure consent banner does not block access to page content for agents",
      });
    }
  }

  return findings;
}

function detectLoginWall(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const root = page.root;
  const html = page.fetch.html;

  // Check if main content is minimal and login form is prominent
  const mainElement = root.querySelector("main");
  const loginForms = root.querySelectorAll('form[action*="login"], form[action*="signin"]');

  if (
    (page.fetch.statusCode === 401 || page.fetch.statusCode === 403) &&
    html.toLowerCase().includes("login")
  ) {
    findings.push({
      id: "login-wall-auth-required",
      severity: "critical",
      message: "Authentication required (401/403 status)",
      detail: `HTTP status ${page.fetch.statusCode}`,
      recommendation:
        "Provide an API endpoint or token-based access for agents, or implement OAuth2/API key authentication",
    });
  }

  // Check for redirect to login
  if (
    html.toLowerCase().includes("redirect") &&
    html.toLowerCase().includes("login")
  ) {
    findings.push({
      id: "login-wall-redirect",
      severity: "critical",
      message: "Page redirects to login",
      detail: "Detected redirect script pointing to login page",
      recommendation: "Provide direct API access or adjust robot.txt rules",
    });
  }

  // Check if page is mostly a login form
  if (loginForms.length > 0) {
    const mainContent = mainElement?.textContent || "";
    const formContent = loginForms[0].textContent || "";
    if (mainContent.length < 200 && formContent.length > 50) {
      findings.push({
        id: "login-wall-minimal-content",
        severity: "warning",
        message: "Page appears to be mostly a login form",
        detail: "Main content is minimal; prominent login form detected",
        recommendation:
          "Expose public content endpoints via API or allow agents to authenticate",
      });
    }
  }

  return findings;
}

function detectUserAgentFiltering(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];

  // 403 Forbidden or 429 Too Many Requests often indicate filtering
  if (page.fetch.statusCode === 403) {
    findings.push({
      id: "ua-filtering-403",
      severity: "warning",
      message: "Access denied (HTTP 403)",
      detail: "Page returned 403 Forbidden; may indicate User-Agent filtering",
      recommendation:
        "Adjust User-Agent header or contact site owner to whitelist your agent",
    });
  }

  if (page.fetch.statusCode === 429) {
    findings.push({
      id: "ua-filtering-rate-limit",
      severity: "warning",
      message: "Rate limited (HTTP 429)",
      detail:
        "Page returned 429 Too Many Requests; rate limiting or bot filtering may be active",
      recommendation:
        "Implement exponential backoff and respect Retry-After headers",
    });
  }

  return findings;
}

export default friction;
