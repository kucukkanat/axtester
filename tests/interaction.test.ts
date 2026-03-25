import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import interaction from "../src/auditors/interaction.ts";

describe("Interaction Surface Auditor", () => {
  it("should count forms and input types", async () => {
    const html = `
      <html>
      <body>
        <form>
          <input type="email" />
          <input type="tel" />
          <input type="text" />
          <select><option>Select</option></select>
        </form>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(result.metadata.formCount).toBe(1);
    expect(result.metadata.typedInputRatio).toBeGreaterThan(0.6);
  });

  it("should warn on untyped inputs", async () => {
    const html = `
      <html>
      <body>
        <form>
          <input type="text" />
          <input type="text" />
          <input type="email" />
        </form>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(
      result.findings.some((f) => f.id === "form-untyped-inputs")
    ).toBe(true);
  });

  it("should detect form state feedback mechanisms", async () => {
    const html = `
      <html>
      <body>
        <form>
          <input type="email" aria-invalid="false" />
          <div aria-live="polite" role="alert"></div>
        </form>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(
      result.findings.some((f) => f.id === "form-no-state-feedback")
    ).toBe(false);
  });

  it("should warn on forms without state feedback", async () => {
    const html = `
      <html>
      <body>
        <form>
          <input type="email" />
          <button type="submit">Submit</button>
        </form>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(
      result.findings.some((f) => f.id === "form-no-state-feedback")
    ).toBe(true);
  });

  it("should detect modal accessibility", async () => {
    const html = `
      <html>
      <body>
        <div role="dialog" aria-labelledby="dialog-title" aria-modal="true">
          <h2 id="dialog-title">Modal Title</h2>
        </div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(
      result.findings.some((f) => f.id === "modal-no-label")
    ).toBe(false);
  });

  it("should warn on modal without aria-labelledby", async () => {
    const html = `
      <html>
      <body>
        <div role="dialog">
          <h2>Modal Title</h2>
        </div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(
      result.findings.some((f) => f.id === "modal-no-label")
    ).toBe(true);
  });

  it("should detect custom listbox accessibility", async () => {
    const html = `
      <html>
      <body>
        <div role="listbox">
          <div role="option">Option 1</div>
          <div role="option">Option 2</div>
        </div>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(
      result.findings.some((f) => f.id === "custom-listbox-no-aria")
    ).toBe(true);
  });

  it("should detect call-to-action buttons", async () => {
    const html = `
      <html>
      <body>
        <button>Buy Now</button>
        <button type="submit">Submit</button>
        <button>Sign Up</button>
        <button>Regular Button</button>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await interaction.audit(page);

    expect(result.metadata.keyActionCount).toBe(3);
  });
});
