import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import temporal from "../src/auditors/temporal.ts";

describe("Temporal Stability Auditor", () => {
  it("should detect hashed class names", async () => {
    const html = `
      <html>
      <body>
        <div class="css-abc123">Content</div>
        <div class="css-def456">More</div>
        <p>Text</p>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await temporal.audit(page);

    expect(result.metadata.hashedClassNameRatio).toBeGreaterThan(0.2);
    expect(
      result.findings.some((f) => f.id === "hashed-classes")
    ).toBe(true);
  });

  it("should warn on Optimizely A/B testing", async () => {
    const html = `
      <html>
      <head>
        <script src="https://cdn.optimizely.com/..."></script>
      </head>
      <body><main>Content</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await temporal.audit(page);

    expect(
      result.findings.some((f) => f.id === "ab-testing-optimizely")
    ).toBe(true);
  });

  it("should detect VWO testing signals", async () => {
    const html = `
      <html>
      <head>
        <script src="https://cdn.visualwebsiteoptimizer.com/..."></script>
      </head>
      <body><main>Content</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await temporal.audit(page);

    expect(
      result.findings.some((f) => f.id === "ab-testing-vwo")
    ).toBe(true);
  });

  it("should detect LaunchDarkly feature flags", async () => {
    const html = `
      <html>
      <head>
        <script src="https://launchdarkly.com/..."></script>
      </head>
      <body><main>Content</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await temporal.audit(page);

    expect(
      result.findings.some((f) => f.id === "feature-flags-launchdarkly")
    ).toBe(true);
  });

  it("should detect Vary: User-Agent header", async () => {
    const html = "<html><body><main>Content</main></body></html>";
    const page = makeParsedPage(html, { vary: "User-Agent" });
    const result = await temporal.audit(page);

    expect(
      result.findings.some((f) => f.id === "dynamic-user-agent-based")
    ).toBe(true);
  });

  it("should note longitudinal data requirement", async () => {
    const html = "<html><body><main>Content</main></body></html>";
    const page = makeParsedPage(html);
    const result = await temporal.audit(page);

    expect(result.metadata.requiresLongitudinalData).toBe(true);
    expect(
      result.findings.some((f) => f.id === "longitudinal-note")
    ).toBe(true);
  });

  it("should calculate selector stability score", async () => {
    const html = `
      <html>
      <body>
        <button id="primary-btn">Click</button>
        <div data-testid="sidebar">Sidebar</div>
        <div class="random-class">Content</div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await temporal.audit(page);

    expect(result.metadata.selectorStabilityScore).toBeGreaterThan(0);
  });

  it("should warn on low selector stability", async () => {
    const html = `
      <html>
      <body>
        <div class="class1">Content</div>
        <div class="class2">More</div>
        <div class="class3">Even more</div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await temporal.audit(page);

    expect(
      result.findings.some((f) => f.id === "selector-instability")
    ).toBe(true);
  });
});
