import { describe, it, expect } from "bun:test";
import { makeParsedPage } from "./helpers.ts";
import extraction from "../src/auditors/extraction.ts";

describe("Extraction Auditor", () => {
  it("should detect JSON-LD presence", async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Example Product"
        }
        </script>
      </head>
      <body><main>Product</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    expect(result.metadata.hasJsonLd).toBe(true);
    expect(result.findings.some((f) => f.severity === "pass")).toBe(true);
  });

  it("should warn when no JSON-LD", async () => {
    const html = `
      <html>
      <body><main>Product</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    expect(result.metadata.hasJsonLd).toBe(false);
    expect(result.findings.some((f) => f.id === "no-json-ld")).toBe(true);
  });

  it("should detect schema types from JSON-LD", async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": []
        }
        </script>
      </head>
      <body><main>Nav</main></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    const types = result.metadata.jsonLdSchemaTypes as string[];
    expect(types).toContain("BreadcrumbList");
  });

  it("should detect proper table markup", async () => {
    const html = `
      <html>
      <body>
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Item 1</td>
              <td>100</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    const tableIssues = result.findings.filter((f) =>
      f.id.includes("table-")
    );
    expect(tableIssues.length).toBe(0);
  });

  it("should detect table without thead", async () => {
    const html = `
      <html>
      <body>
        <table>
          <tr>
            <td>Item 1</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    expect(
      result.findings.some((f) => f.id === "table-missing-thead")
    ).toBe(true);
  });

  it("should detect pagination", async () => {
    const html = `
      <html>
      <body>
        <nav>
          <a href="?page=1">1</a>
          <a href="?page=2">2</a>
          <a rel="next" href="?page=3">Next</a>
        </nav>
      </body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    expect(result.metadata.hasPagination).toBe(true);
    expect(
      result.findings.some((f) => f.id === "no-pagination")
    ).toBe(false);
  });

  it("should detect Open Graph tags", async () => {
    const html = `
      <html>
      <head>
        <meta property="og:title" content="Title" />
        <meta property="og:description" content="Description" />
        <meta name="twitter:card" content="summary" />
      </head>
      <body></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    expect(result.metadata.openGraphCount).toBe(3);
    expect(
      result.findings.some((f) => f.id === "no-og-tags")
    ).toBe(false);
  });

  it("should detect API signals", async () => {
    const html = `
      <html>
      <head>
        <link rel="alternate" type="application/json" href="/api/data.json" />
      </head>
      <body></body>
      </html>
    `;

    const page = makeParsedPage(html);
    const result = await extraction.audit(page);

    expect(result.metadata.hasApiSignals).toBe(true);
  });
});
