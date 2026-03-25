import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import structural from "../src/auditors/structural.ts";

describe("Structural Auditor", () => {
  it("should score high on semantic HTML", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width"><title>Test</title></head>
      <body>
        <header>
          <nav><a href="/">Home</a></nav>
        </header>
        <main>
          <article>
            <h1>Title</h1>
            <p>Content here</p>
          </article>
        </main>
        <footer><p>Footer</p></footer>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await structural.audit(page);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.metadata.domDepth).toBeLessThan(15);
  });

  it("should detect deep DOM nesting", async () => {
    let html = "<html><body>";
    for (let i = 0; i < 20; i++) {
      html += "<div>";
    }
    html += "<p>Deep content</p>";
    for (let i = 0; i < 20; i++) {
      html += "</div>";
    }
    html += "</body></html>";

    const page = makeParsedPage(html);
    const result = await structural.audit(page);

    expect(result.findings.some((f) => f.id === "dom-depth-exceeded")).toBe(
      true
    );
    expect(result.metadata.domDepth).toBeGreaterThan(15);
  });

  it("should detect images without alt text", async () => {
    const html = `
      <html>
      <body>
        <main>
          <img src="image1.jpg" alt="Good alt" />
          <img src="image2.jpg" />
          <img src="image3.jpg" alt="" />
        </main>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await structural.audit(page);

    const altFindings = result.findings.filter(
      (f) => f.id === "image-missing-alt"
    );
    expect(altFindings.length).toBe(2);
  });

  it("should detect SPA structure", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>SPA</title></head>
      <body>
        <div id="root"></div>
        <script src="/app.js"></script>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await structural.audit(page);

    expect(
      result.findings.some((f) => f.id === "client-side-rendering-risk")
    ).toBe(true);
    expect(result.metadata.clientSideRenderingRisk).toBe(true);
  });

  it("should detect canvas elements", async () => {
    const html = `
      <html>
      <body>
        <canvas width="800" height="600"></canvas>
        <p>Other content</p>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await structural.audit(page);

    expect(result.findings.some((f) => f.id === "canvas-content")).toBe(true);
    expect(result.metadata.canvasCount).toBe(1);
  });

  it("should count iframes", async () => {
    const html = `
      <html>
      <body>
        <iframe src="https://example.com"></iframe>
        <iframe src="https://other.com"></iframe>
        <main><p>Main content</p></main>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await structural.audit(page);

    expect(result.metadata.iframeCount).toBe(2);
  });

  it("should detect SVG without title", async () => {
    const html = `
      <html>
      <body>
        <svg width="100" height="100">
          <circle cx="50" cy="50" r="40" />
        </svg>
        <svg width="100" height="100">
          <title>Good SVG</title>
          <circle cx="50" cy="50" r="40" />
        </svg>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await structural.audit(page);

    const svgFindings = result.findings.filter(
      (f) => f.id === "svg-missing-title"
    );
    expect(svgFindings.length).toBe(1);
  });

  it("should calculate content ratio", async () => {
    const contentHeavy = `
      <html>
      <body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <main>
          <h1>Main Content Title</h1>
          <p>This is the actual content of the page that contains substantial text.</p>
          <p>There is lots of meaningful text here explaining the topic in detail.</p>
          <p>This paragraph adds more information to the content of the page.</p>
          <p>And this is yet another paragraph with substantial content.</p>
        </main>
      </body>
      </html>
    `;

    const noiseHeavy = `
      <html>
      <body>
        <nav><ul><li><a href="/">Home</a></li><li><a href="/products">Products</a></li><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li><li><a href="/blog">Blog</a></li></ul></nav>
        <header><h1>Site Header Content Here</h1><p>Tagline or description</p></header>
        <aside><div>Sidebar widget 1 content</div><div>Sidebar widget 2 content</div><div>Sidebar widget 3 content</div><div>Sidebar widget 4</div></aside>
        <main><p>Main Content</p></main>
        <footer><p>Copyright footer text</p><p>Terms link</p><p>Privacy link</p><p>Contact footer</p></footer>
      </body>
      </html>
    `;

    const page1 = makeParsedPage(contentHeavy);
    const page2 = makeParsedPage(noiseHeavy);

    const result1 = await structural.audit(page1);
    const result2 = await structural.audit(page2);

    expect(result1.score).toBeGreaterThanOrEqual(result2.score);
  });
});
