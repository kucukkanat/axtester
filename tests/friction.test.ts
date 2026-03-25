import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import friction from "../src/auditors/friction.ts";

describe("Friction Auditor", () => {
  it("should score 100 with no friction", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body>
        <main>
          <h1>Welcome</h1>
          <p>This is a normal page</p>
        </main>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await friction.audit(page);

    expect(result.score).toBe(100);
    expect(result.category).toBe("anti-agent-friction");
    expect(result.findings.length).toBe(0);
  });

  it("should detect reCAPTCHA", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Protected</title></head>
      <body>
        <iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await friction.audit(page);

    expect(result.score).toBeLessThan(100);
    expect(result.findings.some((f) => f.id === "captcha-recaptcha")).toBe(
      true
    );
    expect(
      result.findings.find((f) => f.id === "captcha-recaptcha")
        ?.severity
    ).toBe("critical");
  });

  it("should detect hCaptcha", async () => {
    const html = `
      <html>
      <body>
        <div class="h-captcha" data-sitekey="test"></div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await friction.audit(page);

    expect(result.findings.some((f) => f.id === "captcha-hcaptcha")).toBe(true);
  });

  it("should detect Cloudflare Turnstile", async () => {
    const html = `
      <html>
      <body>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await friction.audit(page);

    expect(
      result.findings.some((f) => f.id === "captcha-cloudflare-turnstile")
    ).toBe(true);
  });

  it("should detect Cloudflare WAF via headers", async () => {
    const html = "<html><body><main>Test</main></body></html>";
    const page = makeParsedPage(html, { "cf-ray": "abc123def456" });
    const result = await friction.audit(page);

    expect(result.findings.some((f) => f.id === "waf-cloudflare")).toBe(true);
    expect(result.findings.some((f) => f.severity === "warning")).toBe(true);
  });

  it("should detect OneTrust consent wall", async () => {
    const html = `
      <html>
      <body>
        <div id="onetrust-banner-sdk">
          <button id="onetrust-accept-btn">Accept</button>
        </div>
        <main>Content</main>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await friction.audit(page);

    expect(
      result.findings.some((f) => f.id === "consent-wall-oneyrust")
    ).toBe(true);
  });

  it("should detect 403 Forbidden status", async () => {
    const html = "<html><body>Forbidden</body></html>";
    const page = makeParsedPage(html);
    page.fetch.statusCode = 403;
    const result = await friction.audit(page);

    expect(result.findings.some((f) => f.id === "ua-filtering-403")).toBe(true);
  });

  it("should detect 429 rate limiting status", async () => {
    const html = "<html><body>Too Many Requests</body></html>";
    const page = makeParsedPage(html);
    page.fetch.statusCode = 429;
    const result = await friction.audit(page);

    expect(
      result.findings.some((f) => f.id === "ua-filtering-rate-limit")
    ).toBe(true);
  });

  it("should deduct heavily for CAPTCHA", async () => {
    const htmlWithCaptcha = `
      <html>
      <body>
        <iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe>
      </body>
      </html>
    `;

    const htmlClean = `
      <html>
      <body>
        <main><h1>Test</h1></main>
      </body>
      </html>
    `;

    const page1 = makeParsedPage(htmlWithCaptcha);
    const page2 = makeParsedPage(htmlClean);

    const result1 = await friction.audit(page1);
    const result2 = await friction.audit(page2);

    expect(result2.score).toBeGreaterThan(result1.score);
    expect(result1.score).toBeLessThanOrEqual(65);
  });
});
