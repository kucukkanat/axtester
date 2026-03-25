import type { ParsedPage, AuditorModule, Finding } from "../types.ts";

export const extraction: AuditorModule = {
  category: "data-extraction-quality",
  weight: 0.12,
  audit: (page: ParsedPage) => {
    let score = 100;
    const findings: Finding[] = [];
    const metadata: Record<string, unknown> = {};

    // JSON-LD Presence
    const jsonLdScripts = page.root.querySelectorAll('script[type="application/ld+json"]');
    const hasJsonLd = jsonLdScripts.length > 0;
    metadata.hasJsonLd = hasJsonLd;
    metadata.jsonLdSchemaTypes = extractJsonLdTypes(page);

    const jsonLdFindings = checkJsonLd(page);
    findings.push(...jsonLdFindings);
    if (!hasJsonLd) {
      score -= 15;
    }

    // Microdata Presence
    const microdataCount = page.root.querySelectorAll(
      "[itemscope], [itemprop]"
    ).length;
    metadata.microdataCount = microdataCount;
    if (microdataCount === 0) {
      findings.push({
        id: "no-microdata",
        severity: "info",
        message: "Page does not use microdata (itemscope, itemprop)",
        detail: "No microdata attributes found",
        recommendation:
          "Consider adding schema.org microdata or JSON-LD structured data",
      });
      score -= 8;
    }

    // Open Graph / Twitter Card
    const ogCount = page.root.querySelectorAll(
      'meta[property^="og:"], meta[name^="twitter:"]'
    ).length;
    metadata.openGraphCount = ogCount;
    if (ogCount === 0) {
      findings.push({
        id: "no-og-tags",
        severity: "info",
        message: "No Open Graph or Twitter Card meta tags found",
        detail: "Missing og: and twitter: meta tags for social sharing",
        recommendation:
          "Add Open Graph meta tags (og:title, og:description, og:image) for better shareability",
      });
      score -= 5;
    }

    // Table Markup Quality
    const tableFindings = checkTableMarkup(page);
    findings.push(...tableFindings);
    metadata.properTablesCount = page.root.querySelectorAll("table").length;
    tableFindings.forEach((f) => {
      if (f.severity === "warning") score -= 10;
      else score -= 5;
    });

    // Pagination Navigability
    const paginationFindings = checkPagination(page);
    findings.push(...paginationFindings);
    metadata.hasPagination = paginationFindings.length === 0;
    if (paginationFindings.length > 0) {
      score -= 8;
    }

    // API Availability Signals
    const apiFindings = checkApiSignals(page);
    findings.push(...apiFindings);
    metadata.hasApiSignals = apiFindings.length > 0;
    if (apiFindings.length > 0) {
      score += 10; // Bonus for API availability
    }

    score = Math.max(0, Math.min(100, score));

    return {
      category: "data-extraction-quality",
      score,
      weight: 0.12,
      findings,
      metadata,
    };
  },
};

function checkJsonLd(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const jsonLdScripts = page.root.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  if (jsonLdScripts.length === 0) {
    findings.push({
      id: "no-json-ld",
      severity: "warning",
      message: "Page does not include JSON-LD structured data",
      detail: 'No <script type="application/ld+json"> found',
      recommendation:
        'Add JSON-LD structured data (e.g., schema.org/Product, schema.org/Article) for better machine readability',
    });
  } else {
    findings.push({
      id: "has-json-ld",
      severity: "pass",
      message: `Found ${jsonLdScripts.length} JSON-LD block(s)`,
      detail: `JSON-LD structured data is present`,
    });
  }

  return findings;
}

function extractJsonLdTypes(page: ParsedPage): string[] {
  const types: string[] = [];
  const jsonLdScripts = page.root.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  for (const script of jsonLdScripts) {
    try {
      const content = script.textContent;
      if (content) {
        const data = JSON.parse(content);
        if (data["@type"]) {
          const type = Array.isArray(data["@type"])
            ? data["@type"][0]
            : data["@type"];
          types.push(type);
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  return types;
}

function checkTableMarkup(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const tables = page.root.querySelectorAll("table");

  if (tables.length === 0) {
    return findings;
  }

  for (const table of tables) {
    const hasHead = table.querySelector("thead");
    const hasFoot = table.querySelector("tfoot");
    const hasCaption = table.querySelector("caption");
    const thElements = table.querySelectorAll("th");

    if (!hasHead) {
      findings.push({
        id: "table-missing-thead",
        severity: "warning",
        message: "Table missing <thead> element",
        detail: "Table structure not properly defined with thead/tbody",
        recommendation:
          "Add <thead>, <tbody>, and optionally <tfoot> for proper table semantics",
      });
    }

    // Check if th elements have scope attribute
    const thWithoutScope = Array.from(thElements).filter(
      (th) => !th.getAttribute("scope")
    );
    if (thWithoutScope.length > 0) {
      findings.push({
        id: "table-th-missing-scope",
        severity: "info",
        message: `${thWithoutScope.length} <th> element(s) missing scope attribute`,
        detail: "Header cells should have scope='col' or scope='row'",
        recommendation:
          "Add scope attribute to all <th> elements for better table semantics",
      });
    }
  }

  return findings;
}

function checkPagination(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];

  // Check for rel="next"
  const nextLink = page.root.querySelector('a[rel="next"], link[rel="next"]');
  if (nextLink) {
    return findings; // Has pagination
  }

  // Check for pagination patterns in links
  const links = page.root.querySelectorAll("a");
  const paginationLinks = Array.from(links).filter((link) => {
    const href = link.getAttribute("href") || "";
    const text = link.textContent?.toLowerCase() || "";
    return (
      href.includes("?page=") ||
      href.includes("?offset=") ||
      text.includes("next") ||
      text.includes("previous") ||
      text.match(/^\d+$/)
    );
  });

  if (paginationLinks.length === 0) {
    findings.push({
      id: "no-pagination",
      severity: "info",
      message: "No machine-readable pagination navigation found",
      detail:
        "Missing rel='next' link or standard pagination URL patterns (?page=, ?offset=)",
      recommendation:
        "Implement standard pagination patterns or use rel='next' / rel='prev' links",
    });
  }

  return findings;
}

function checkApiSignals(page: ParsedPage): Finding[] {
  const findings: Finding[] = [];
  const html = page.fetch.html.toLowerCase();
  const head = page.root.querySelector("head") || page.root;

  // Check for alternate JSON link
  const jsonLink = page.root.querySelector(
    'link[rel="alternate"][type="application/json"]'
  );
  if (jsonLink) {
    findings.push({
      id: "api-json-link",
      severity: "pass",
      message: "JSON API endpoint advertised via link rel",
      detail: 'Found <link rel="alternate" type="application/json">',
    });
    return findings;
  }

  // Check for .well-known/
  if (html.includes(".well-known/")) {
    findings.push({
      id: "api-well-known",
      severity: "pass",
      message: "API well-known endpoints detected",
      detail: "References to .well-known/ endpoints for API discovery",
    });
    return findings;
  }

  // Check for api. subdomain hints
  if (html.includes("api.") || html.includes("/api/")) {
    findings.push({
      id: "api-endpoint-hints",
      severity: "info",
      message: "API endpoint patterns detected in HTML",
      detail: "Found references to /api/ paths or api. subdomains",
    });
    return findings;
  }

  return findings;
}

export default extraction;
