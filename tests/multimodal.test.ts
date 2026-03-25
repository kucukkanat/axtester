import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import multimodal from "../src/auditors/multimodal.ts";

describe("Multi-Modal Readiness Auditor", () => {
  it("should score high with full alt text coverage", async () => {
    const html = `
      <html>
      <body>
        <img src="image1.jpg" alt="First image" />
        <img src="image2.jpg" alt="Second image" />
        <img src="image3.jpg" alt="Third image" />
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(result.metadata.imageAltRatio).toBe(1.0);
    expect(
      result.findings.some((f) => f.severity === "pass" && f.id.includes("alt"))
    ).toBe(true);
  });

  it("should flag low alt text coverage", async () => {
    const html = `
      <html>
      <body>
        <img src="image1.jpg" />
        <img src="image2.jpg" />
        <img src="image3.jpg" alt="Only this one" />
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(result.metadata.imageAltRatio).toBe(1 / 3);
    expect(
      result.findings.some((f) => f.id === "image-alt-coverage-critical")
    ).toBe(true);
  });

  it("should detect icon-only buttons", async () => {
    const html = `
      <html>
      <body>
        <button><svg viewBox="0 0 24 24"><path d="..."/></svg></button>
        <button>Text Button</button>
        <button><img src="icon.png" /> Icon with text</button>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(result.metadata.iconOnlyButtonCount).toBe(1);
    expect(
      result.findings.some((f) => f.id === "icon-only-button")
    ).toBe(true);
  });

  it("should detect missing viewport meta", async () => {
    const html = `
      <html>
      <head>
        <title>Test</title>
      </head>
      <body><main>Content</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(result.metadata.hasViewportMeta).toBe(false);
    expect(
      result.findings.some((f) => f.id === "missing-viewport-meta")
    ).toBe(true);
  });

  it("should accept viewport meta", async () => {
    const html = `
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body><main>Content</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(result.metadata.hasViewportMeta).toBe(true);
    expect(
      result.findings.some((f) => f.id === "missing-viewport-meta")
    ).toBe(false);
  });

  it("should detect SVG title presence", async () => {
    const html = `
      <html>
      <body>
        <svg width="100"><title>Good SVG</title><circle cx="50" cy="50" r="40" /></svg>
        <svg width="100"><circle cx="50" cy="50" r="40" /></svg>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(result.metadata.svgTitleRatio).toBe(0.5);
    expect(
      result.findings.some((f) => f.id === "svg-title-coverage")
    ).toBe(true);
  });

  it("should count tabbable elements", async () => {
    const html = `
      <html>
      <body>
        <a href="/">Link</a>
        <button>Button</button>
        <input type="text" />
        <select><option>Select</option></select>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(result.metadata.tabbableElements).toBeGreaterThanOrEqual(4);
  });

  it("should warn on excessive negative tabindex", async () => {
    const html = `
      <html>
      <body>
        <div tabindex="-1">1</div>
        <div tabindex="-1">2</div>
        <div tabindex="-1">3</div>
        <div tabindex="-1">4</div>
        <div tabindex="-1">5</div>
        <div tabindex="-1">6</div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await multimodal.audit(page);

    expect(
      result.findings.some((f) => f.id === "excessive-negative-tabindex")
    ).toBe(true);
  });
});
