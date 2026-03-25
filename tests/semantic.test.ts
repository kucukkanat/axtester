import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import semantic from "../src/auditors/semantic.ts";

describe("Semantic Auditor", () => {
  it("should approve proper heading hierarchy", async () => {
    const html = `
      <html>
      <body>
        <h1>Main Title</h1>
        <h2>Section 1</h2>
        <p>Content</p>
        <h2>Section 2</h2>
        <p>More content</p>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    expect(
      result.findings.some((f) => f.id === "no-h1" || f.id === "multiple-h1")
    ).toBe(false);
  });

  it("should detect missing h1", async () => {
    const html = `
      <html>
      <body>
        <h2>Section Title</h2>
        <p>Content</p>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    expect(result.findings.some((f) => f.id === "no-h1")).toBe(true);
  });

  it("should detect heading level skip", async () => {
    const html = `
      <html>
      <body>
        <h1>Main Title</h1>
        <h3>Skipped h2</h3>
        <p>Content</p>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    expect(
      result.findings.some((f) => f.id === "heading-level-skip")
    ).toBe(true);
  });

  it("should detect generic button labels", async () => {
    const html = `
      <html>
      <body>
        <button>Submit</button>
        <button>Click here</button>
        <button>Read more</button>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    const genericFindings = result.findings.filter(
      (f) => f.id === "button-generic-label"
    );
    expect(genericFindings.length).toBe(2);
  });

  it("should detect empty button labels", async () => {
    const html = `
      <html>
      <body>
        <button></button>
        <button>  </button>
        <button>Good label</button>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    const emptyFindings = result.findings.filter(
      (f) => f.id === "button-empty-label"
    );
    expect(emptyFindings.length).toBe(2);
  });

  it("should detect form fields without labels", async () => {
    const html = `
      <html>
      <body>
        <form>
          <label for="email">Email:</label>
          <input type="email" id="email" />

          <input type="text" id="name" />

          <input type="password" aria-label="Password" />
        </form>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    const unlabeledFindings = result.findings.filter(
      (f) => f.id === "form-field-missing-label"
    );
    expect(unlabeledFindings.length).toBe(1);
  });

  it("should recognize semantic HTML tags", async () => {
    const html = `
      <html>
      <body>
        <header>Header</header>
        <nav>Nav</nav>
        <main>
          <article>Article</article>
          <aside>Aside</aside>
        </main>
        <footer>Footer</footer>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    expect(result.metadata.semanticTagRatio).toBeGreaterThan(0.3);
    expect(
      result.findings.some((f) => f.id === "low-semantic-ratio")
    ).toBe(false);
  });

  it("should score low on div-heavy layout", async () => {
    const html = `
      <html>
      <body>
        <div>
          <div>
            <div>Header</div>
            <div>Nav</div>
          </div>
          <div>
            <div>Main</div>
            <div>Content</div>
          </div>
          <div>
            <div>Footer</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    expect(result.metadata.semanticTagRatio).toBeLessThan(0.3);
    expect(
      result.findings.some((f) => f.id === "low-semantic-ratio")
    ).toBe(true);
  });

  it("should detect link label issues", async () => {
    const html = `
      <html>
      <body>
        <a href="/about">About Us</a>
        <a href="/contact"></a>
        <a href="/products">Learn more</a>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await semantic.audit(page);

    expect(
      result.findings.some((f) => f.id === "link-empty-label")
    ).toBe(true);
    expect(
      result.findings.some((f) => f.id === "link-generic-label")
    ).toBe(true);
  });
});
