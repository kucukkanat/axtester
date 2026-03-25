import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import tokenEconomics from "../src/auditors/token-economics.ts";

describe("Token Economics Auditor", () => {
  it("should estimate tokens correctly", async () => {
    const html = "Hello world"; // 11 chars ≈ 3 tokens
    const page = makeParsedPage(html);
    const result = await tokenEconomics.audit(page);

    const estimatedTokens = result.metadata.rawHtmlTokens as number;
    expect(estimatedTokens).toBeGreaterThan(0);
    expect(estimatedTokens).toBeLessThan(10);
  });

  it("should flag extreme content-to-noise ratio", async () => {
    const html = `
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; }
          .container { width: 1200px; }
          .nav { display: flex; }
          .nav-item { padding: 10px; }
        </style>
      </head>
      <body>
        <nav class="nav">
          <a class="nav-item">Home</a>
          <a class="nav-item">Products</a>
          <a class="nav-item">About</a>
        </nav>
        <main>Hi</main>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await tokenEconomics.audit(page);

    expect(
      result.findings.some((f) => f.id === "extreme-noise" || f.id === "high-noise")
    ).toBe(true);
    expect(result.score).toBeLessThan(75);
  });

  it("should track content ratio", async () => {
    const html = `
      <html>
      <body>
        <main>
          <h1>Article Title</h1>
          <p>Content paragraph</p>
        </main>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await tokenEconomics.audit(page);

    // Just verify that token metrics are calculated
    expect(result.metadata.contentToNoiseRatio).toBeDefined();
    expect(typeof result.metadata.contentToNoiseRatio).toBe("number");
    expect(result.metadata.rawHtmlTokens).toBeDefined();
  });

  it("should note JSON-LD API opportunity", async () => {
    const html = `
      <html>
      <body>
        <h1>Product</h1>
        <p>$99.99</p>
        <p>Long description here...</p>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await tokenEconomics.audit(page);

    expect(result.findings.some((f) => f.id === "api-opportunity")).toBe(true);
  });

  it("should recognize when JSON-LD is present", async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {"@type": "Product", "name": "Test"}
        </script>
      </head>
      <body>
        <h1>Product</h1>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await tokenEconomics.audit(page);

    expect(
      result.findings.some((f) => f.id === "api-already-present")
    ).toBe(true);
  });

  it("should include cost estimates", async () => {
    const html = "<html><body><p>Test page content</p></body></html>";
    const page = makeParsedPage(html);
    const result = await tokenEconomics.audit(page);

    expect(result.metadata.rawHtmlTokens).toBeDefined();
    expect(result.metadata.rawHtmlCost).toBeDefined();
    expect(result.metadata.markdownTokens).toBeDefined();
  });
});
