# axagent - AI Agent Readiness Auditor

Audit any website for AI agent accessibility across two modes:

1. **Static Analysis** (Fast) - Measure how well a site's structure, semantics, and content support agent access across 8 dimensions
2. **Dynamic Testing** (Deep) - Use an LLM-powered agent to actually navigate the site, interact with it, and report real-world barriers

**Status**: Production-ready | **Tests**: 71 passing ✓ | **Runtime**: Bun | **Modes**: Static audit + Dynamic task execution | **Stealth**: Anti-bot detection evasion included

## Quick Start

### Install
```bash
cd /Users/kucukkanat/Developer/axagent
bun install
```

### Static Audit (Fast Analysis)
```bash
# Basic audit (colored text output)
bun run cli.ts https://example.com

# JSON output (for processing)
bun run cli.ts https://example.com --format json

# Markdown report (for GitHub issues)
bun run cli.ts https://example.com --format md --output report.md
```

### Dynamic Task Execution (Real-World Testing)
```bash
# Set LLM API key (Claude or OpenAI)
export LLM_API_KEY=sk-ant-...

# Run a task with an LLM agent
bun run cli.ts task https://example.com "Find the product price"

# With stealth mode (bypass bot protection)
bun run cli.ts task https://protected-site.com "Get data" --stealth

# Combined: run task + static audit
bun run cli.ts task https://example.com "Test form submission" --with-audit
```

### Claude Code Skill
When working with Claude Code (this editor), use the integrated skill:

```
Ask Claude: "Audit https://example.com for agent readiness"
Claude will automatically invoke axagent and show you results
```

---

## CLI Usage Guide

### Basic Command
```bash
bun run cli.ts <url> [options]
```

### Arguments
| Argument | Required | Description |
|----------|----------|-------------|
| `url` | Yes | The website URL to audit (e.g., https://example.com) |

### Options

#### Output Format
```bash
# Text output (default) - colored terminal report
bun run cli.ts https://example.com

# JSON output - machine-readable, good for processing
bun run cli.ts https://example.com --format json

# Markdown - GitHub-friendly report
bun run cli.ts https://example.com --format md

# Short flag
bun run cli.ts https://example.com -f json
```

#### Category Selection
Run only specific audit categories:
```bash
# Anti-agent friction and token economics only
bun run cli.ts https://example.com --categories anti-agent-friction,token-economics

# All structural and semantic checks
bun run cli.ts https://example.com -c structural-parsability,semantic-clarity
```

Available categories:
- `anti-agent-friction` - CAPTCHA, WAF, login walls, bot filtering
- `structural-parsability` - DOM depth, content ratio, SPA detection
- `semantic-clarity` - HTML semantics, labels, heading hierarchy
- `interaction-surface` - Form accessibility, ARIA, modals
- `data-extraction-quality` - JSON-LD, tables, microdata, pagination
- `token-economics` - Token cost, content noise ratio
- `temporal-stability` - Class name stability, A/B testing
- `multimodal-readiness` - Alt text, viewport, contrast

#### Other Options
```bash
# Custom timeout (default: 15000ms)
bun run cli.ts https://example.com --timeout 30000

# Custom User-Agent
bun run cli.ts https://example.com --user-agent "MyBot/1.0"

# Save to file instead of stdout
bun run cli.ts https://example.com --format md -o audit-report.md

# Quiet mode (only output the report, no progress messages)
bun run cli.ts https://example.com --quiet

# Disable ANSI colors
bun run cli.ts https://example.com --no-color

# Show help
bun run cli.ts --help

# Show version
bun run cli.ts --version
```

### CLI Examples

#### Example 1: Quick audit of a site
```bash
$ bun run cli.ts https://github.com

axagent audit: https://github.com
Fetched in 245ms

Overall Score: 78/100 (Grade: B)
This website scored 78/100 (grade: B) on AI agent readiness. The site is well-optimized...

Category Breakdown:
────────────────────────────────────────────────────
🟢 Structural Parsability         85/100  ✓ No issues
🔵 Semantic Clarity               82/100  1 missing alt text
🔵 Interaction Surface            71/100  2 form fields missing labels
🟠 Anti-Agent Friction            65/100  Cloudflare WAF detected
🟡 Data Extraction Quality        88/100  JSON-LD present: BreadcrumbList
🟡 Token Economics                60/100  Content ratio: 0.12 (moderate noise)
🔵 Temporal Stability             72/100  Hashed classes: 22%
🟢 Multi-Modal Readiness          80/100  3 images missing alt text
────────────────────────────────────────────────────
```

#### Example 2: Export as JSON for processing
```bash
$ bun run cli.ts https://example.com --format json

{
  "url": "https://example.com",
  "fetchedAt": "2026-03-25T10:30:45.123Z",
  "durationMs": 342,
  "overallScore": 71,
  "grade": "B",
  "categories": [
    {
      "category": "anti-agent-friction",
      "score": 45,
      "weight": 0.18,
      "findings": [
        {
          "id": "captcha-recaptcha",
          "severity": "critical",
          "message": "reCAPTCHA detected",
          "detail": "Found reCAPTCHA iframe or script",
          "recommendation": "Consider implementing a JSON API..."
        }
      ],
      "metadata": { ... }
    },
    ...
  ],
  "summary": "This website scored 71/100..."
}
```

#### Example 3: Save Markdown report for team review
```bash
$ bun run cli.ts https://ecommerce.example.com --format md --output audit.md
✅ Report written to audit.md

$ cat audit.md

# AI Agent Readiness Audit Report

**URL:** https://ecommerce.example.com
**Date:** 2026-03-25T10:30:45.123Z
**Overall Score:** 71/100 (Grade: B)

## Summary
This website scored 71/100...

## Category Scores
| Category | Score | Grade |
|----------|-------|-------|
| Anti-Agent Friction | 45/100 | D |
| Structural Parsability | 82/100 | B |
...
```

#### Example 4: Audit specific categories
```bash
$ bun run cli.ts https://example.com -c anti-agent-friction,token-economics

axagent audit: https://example.com
Fetched in 156ms

Anti-Agent Friction: 45/100 - Cloudflare WAF detected (cf-ray header)
Token Economics: 55/100 - Content-to-noise ratio: 0.08 (low)
```

---

## Task Execution Mode (Dynamic Testing with LLM Agent)

Beyond static analysis, axagent can **actually navigate websites** using an LLM-powered agent. The agent reads the page, clicks elements, fills forms, extracts data, and reports barriers it encounters.

### Setup

```bash
# Install Bun packages (includes Puppeteer + LLM SDKs)
bun install

# Set your LLM API key (Claude recommended)
export LLM_API_KEY=sk-ant-...
export LLM_PROVIDER=claude  # or 'openai' for GPT-4/others
```

### Basic Usage

```bash
# Run a task on a website
LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Find the product price"

# Task execution with stealth mode (bypass bot protection)
LLM_API_KEY=sk-ant-... bun run cli.ts task https://protected-site.com "Get data" --stealth

# Combine dynamic task + static audit
LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Fill contact form" --with-audit --format md
```

### Task Execution Options

```bash
--model              LLM model ID (default: claude-opus-4-5)
--max-steps          Maximum agent steps (default: 30)
--with-audit         Include static audit in report
--no-screenshots     Disable screenshot capture per step
--stealth            Enable anti-bot detection evasion
--format             Output format: text | json | md
--output             Save report to file
```

### What the Agent Can Do

The agent has 11 tools available:

| Tool | Purpose |
|------|---------|
| **navigate** | Go to URLs |
| **click** | Click buttons, links, form elements |
| **type** | Type text into input fields |
| **scroll** | Scroll page up/down |
| **select** | Choose dropdown options |
| **extract_text** | Read text from page or specific elements |
| **find_elements** | Search for elements by text |
| **screenshot** | Capture page state |
| **wait** | Wait for time or selector |
| **done** | Complete task with answer |
| **fail** | Abandon if barrier encountered |

### Barriers Detected

When the agent encounters obstacles, it reports them:

- **captcha** - CAPTCHA, reCAPTCHA, hCaptcha
- **login-wall** - Authentication required (401/403)
- **consent-wall** - Cookie/privacy walls
- **rate-limit** - Rate limiting (429)
- **missing-label** - Elements without accessible text
- **no-accessible-element** - Interactive elements not reachable
- **navigation-timeout** - Page loads too slowly
- **loop-detected** - Agent stuck in repeat action

### Example Task Output

```
$ LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Find the cheapest item"

🤖 Running task on https://example.com...
📝 Prompt: Find the cheapest item

Step 1: Navigate to URL
Step 2: Click "Products" button
Step 3: Extract product prices
Step 4: Click "Sort by price"
Step 5: Extract cheapest item name

✅ Outcome: COMPLETED
📍 Agent Found: "Blue Shirt - $15.99"

Barriers Encountered: 0
Score: 95/100

Tokens Used: 2,847 input + 1,234 output
Estimated Cost: $0.0342
```

### LLM Provider Configuration

#### Claude (Anthropic)
```bash
export LLM_API_KEY=sk-ant-...
export LLM_PROVIDER=claude
export LLM_MODEL=claude-opus-4-5  # or claude-sonnet-4-6, claude-haiku-4-5
```

#### OpenAI / GPT-4
```bash
export LLM_API_KEY=sk-...
export LLM_PROVIDER=openai
export LLM_MODEL=gpt-4
```

#### Other OpenAI-Compatible (Gemini, local models, etc.)
```bash
export LLM_API_KEY=...
export LLM_PROVIDER=openai
export LLM_MODEL=your-model-id
export LLM_BASE_URL=https://api.example.com/v1  # Custom endpoint
```

### Stealth Mode (Anti-Bot Detection)

When auditing sites with bot protection, enable stealth mode:

```bash
LLM_API_KEY=sk-ant-... bun run cli.ts task https://cloudflare-protected.com "Get data" --stealth
```

**Stealth Mode includes:**
- User-Agent rotation (8 realistic browsers)
- WebDriver property masking
- Browser fingerprint spoofing
- Human-like delays (800-3000ms per action)
- Mouse movement simulation
- Geolocation spoofing
- Realistic HTTP headers

**Granular control:**
```bash
--stealth              # Enable all stealth features
--no-stealth-delay     # Disable randomized delays only
--no-stealth-mouse     # Disable mouse simulation
--no-stealth-geo       # Disable geolocation spoofing
--no-stealth-ua        # Disable User-Agent rotation
```

### Combined Audit + Task Report

```bash
LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Test form" --with-audit --format md
```

Output includes:
1. **Static Audit** - All 8 categories analyzed
2. **Task Execution** - What agent accomplished/barriers encountered
3. **Correlations** - Links between task barriers and audit findings
4. **Insights** - Recommendations for improvement

---

## Claude Code Skill Usage

The axagent skill is automatically registered with Claude Code. When you ask Claude about website audits, it can invoke the tool directly.

### How to Use the Skill

#### Ask Claude in your project
```
Static audit:
"Audit https://github.com for AI agent readiness"

Dynamic task execution:
"Use an LLM agent to find the cheapest product on https://example.com"

Claude will:
1. Recognize the request matches the axagent skill
2. Run the audit or task automatically
3. Display detailed results in your conversation
```

#### Common questions that trigger the skill
- "How agent-friendly is https://example.com?"
- "Can an AI agent use this site reliably?"
- "What's the token cost to fetch https://example.com?"
- "Does this site have CAPTCHA or bot friction?"
- "Audit https://example.com for LLM readiness"
- "Check if https://example.com is accessible to automated tools"
- "Use an agent to get data from https://example.com"
- "Test if a bot can complete the signup form on https://example.com"

#### Skill-specific capabilities
The skill can:
- Run static audits on any public URL
- Execute dynamic tasks with LLM agents
- Output results in your preferred format
- Analyze specific audit categories
- Generate reports for documentation
- Compare multiple sites side-by-side
- Detect bot protection barriers

### Example: Using the Skill
```
You: "Audit https://example.com and export as JSON"

Claude: I'll audit that site for you using axagent.
[Claude runs the audit using the axagent skill]

Here's the JSON report:
{
  "url": "https://example.com",
  "overallScore": 71,
  "grade": "B",
  ...
}
```

---

## Grade Interpretation

| Grade | Range | Meaning |
|-------|-------|---------|
| **A** | 85-100 | Excellent AI agent readiness. Minimal friction, clean structure, semantic clarity. |
| **B** | 70-84 | Good. Some friction or noise, but addressable. Agents can work well. |
| **C** | 55-69 | Moderate issues. Agents will work but may be brittle or expensive. |
| **D** | 40-54 | Significant barriers. Heavy friction, poor semantics, high token cost. |
| **F** | 0-39 | Not agent-ready. CAPTCHA, login wall, or rendered-only content blocks agents. |

---

## Understanding the Audit Categories

### 1. Anti-Agent Friction (18% weight - HIGHEST)
**What it measures**: Barriers that prevent or slow down agent access.

**Detects**:
- reCAPTCHA, hCaptcha, Cloudflare Turnstile
- WAF/bot filtering (Cloudflare, Akamai, Imperva headers)
- Cookie consent walls (OneTrust, CookiePro)
- Login/authentication walls
- User-Agent filtering (403/429 responses)

**Why it's important**: A page with CAPTCHA is essentially off-limits to agents, making all other scores irrelevant.

### 2. Structural Parsability (15%)
**What it measures**: Can agents read and understand the page structure?

**Checks**:
- DOM depth (deeper = harder to parse)
- Content-to-chrome ratio (how much is actual content vs navigation/boilerplate)
- Single Page App (SPA) detection (JavaScript-only rendering)
- Text trapped in images/SVGs
- Canvas elements without text descriptions

**Recommendation**: Keep DOM depth under 15 levels, ensure >30% of content is actual text.

### 3. Semantic Clarity (15%)
**What it measures**: Is the HTML semantic and self-describing?

**Checks**:
- Use of semantic tags (`<article>`, `<main>`, `<nav>`, `<aside>`)
- Proper heading hierarchy (h1 → h2 → h3, no skips)
- Form field labels (proper `<label>` or `aria-label` association)
- Button/link text (no generic "Click here", no empty labels)
- ARIA attributes for custom controls

**Recommendation**: Use semantic HTML, add `aria-label` to interactive elements, label all form fields.

### 4. Interaction Surface (12%)
**What it measures**: Can agents interact with forms and UI?

**Checks**:
- Form field types (prefer `type="email"`, `type="tel"` over generic `type="text"`)
- Machine-readable state feedback (aria-live, role="alert", aria-invalid)
- Modal accessibility (proper `role="dialog"`, `aria-labelledby`)
- Custom dropdown accessibility (ARIA attributes present)
- Call-to-action buttons detection

**Recommendation**: Use typed inputs, add ARIA state indicators, provide accessible modals.

### 5. Data Extraction Quality (12%)
**What it measures**: Can structured data be reliably extracted?

**Checks**:
- JSON-LD presence (schema.org structured data)
- Microdata (`itemscope`, `itemprop`)
- Open Graph / Twitter Card tags
- Proper table markup (`<thead>`, `<th scope>`)
- Pagination patterns (rel="next", ?page=)
- API availability signals

**Recommendation**: Add JSON-LD blocks for products, articles, breadcrumbs. Use proper table semantics.

### 6. Token Economics (10%)
**What it measures**: How expensive is it to process this page with an LLM?

**Checks**:
- Token count estimation for raw HTML
- Content-to-noise ratio (meaningful text vs boilerplate)
- Redundant content detection (repeated headers/footers)
- Potential token savings with JSON-LD/API

**Shows**: Cost in dollars per agent visit, potential savings with structured data.

**Recommendation**: Minimize boilerplate HTML, add JSON-LD to reduce token cost.

### 7. Temporal Stability (8%)
**What it measures**: Will agent selectors break after site updates?

**Checks**:
- Hashed class names (CSS Modules, Tailwind JIT)
- A/B testing platforms (Optimizely, Google Optimize, VWO)
- Dynamic rendering signals (Vary: User-Agent headers)
- Selector stability (IDs + data-* attrs vs class-only)

**Note**: This is a snapshot. True stability requires comparing multiple audits over time.

**Recommendation**: Use stable selectors (IDs, data-* attributes) for elements agents depend on.

### 8. Multi-Modal Readiness (10%)
**What it measures**: How well does the page work for vision-based agents?

**Checks**:
- Image alt text coverage (% of images with alt)
- SVG title elements
- Icon-only buttons (must have text or aria-label)
- Viewport meta tag
- Focus management (tabindex usage)

**Recommendation**: Add alt text to all images, label icon buttons, include viewport meta.

---

## Library API

Use axagent as a TypeScript library in your own Bun projects:

### Installation
```bash
# Add to your Bun project
cp -r /Users/kucukkanat/Developer/axagent/src ./axagent-src
cp /Users/kucukkanat/Developer/axagent/package.json ./package.json
bun install
```

### Basic Usage
```typescript
import { runAudit } from "./axagent-src/index.ts";

const report = await runAudit("https://example.com");

console.log(`Score: ${report.overallScore}/100 (${report.grade})`);
console.log(report.summary);

// Access individual categories
for (const category of report.categories) {
  console.log(`${category.category}: ${category.score}/100`);
  for (const finding of category.findings) {
    console.log(`  - ${finding.message}`);
  }
}
```

### Advanced Usage
```typescript
import { runAudit, fetchPage, parsePage } from "./axagent-src/index.ts";

// Custom options
const report = await runAudit("https://example.com", {
  categories: ["anti-agent-friction", "token-economics"],
  fetchOptions: {
    timeoutMs: 30000,
    userAgent: "MyBot/1.0",
  },
});

// Manual control: fetch → parse → audit
const fetch = await fetchPage("https://example.com");
const page = parsePage(fetch);

// Run individual auditors
import { frictionAuditor, structuralAuditor } from "./axagent-src/index.ts";

const frictionScore = await frictionAuditor.audit(page);
const structuralScore = await structuralAuditor.audit(page);
```

### Bun-Specific Features
axagent uses Bun's native APIs:

```typescript
import { runAudit } from "./axagent-src/index.ts";

// Uses Bun.fetch for HTTP requests
const report = await runAudit("https://example.com");

// Use Bun.write for file output
await Bun.write("audit-report.json", JSON.stringify(report, null, 2));

// Use Bun.exit for proper process termination
if (report.grade === "F") {
  Bun.exit(1);
}
```

### Types
```typescript
import type {
  AuditReport,
  CategoryScore,
  Finding,
  AuditCategory,
} from "./axagent-src/index.ts";

const report: AuditReport = await runAudit("https://example.com");
// report.overallScore: number (0-100)
// report.grade: "A" | "B" | "C" | "D" | "F"
// report.categories: CategoryScore[]
// report.findings: Finding[]
```

---

## Common Workflows

### Check if a site is bot-friendly
```bash
$ bun run cli.ts https://example.com -c anti-agent-friction
```
Look for CAPTCHA, WAF, login walls. Score of 80+ = agent-friendly.

### Estimate cost of scraping
```bash
$ bun run cli.ts https://example.com -c token-economics --format json
```
Check `metadata.rawHtmlCost` and `metadata.potentialSavingsPer1kVisits` for API.

### Find accessibility issues
```bash
$ bun run cli.ts https://example.com -c semantic-clarity,interaction-surface
```
Look for missing labels, bad heading hierarchy, poor form field types.

### Compare multiple sites
```bash
$ bun run cli.ts https://site1.com --format json > site1.json
$ bun run cli.ts https://site2.com --format json > site2.json

# Compare scores
$ jq '.overallScore' site1.json site2.json
```

### Monitor site changes over time
```bash
# Week 1
$ bun run cli.ts https://example.com --format json > audit-week1.json

# Week 2
$ bun run cli.ts https://example.com --format json > audit-week2.json

# Check temporal stability score changed
$ jq '.categories[] | select(.category=="temporal-stability") | .score' audit-*.json
```

---

## Testing with Bun

Run the test suite to verify functionality:

```bash
# Run all tests (Bun's native test runner)
bun test

# Run specific test file
bun test tests/friction.test.ts

# Watch mode (reruns on file changes)
bun test --watch

# Type check with Bun's TypeScript support
bunx tsc --noEmit
```

### Test Framework
Tests use Bun's native test runner (imported from `"bun:test"`):

```typescript
import { describe, it, expect } from "bun:test";

describe("Friction Auditor", () => {
  it("should score 100 with no friction", async () => {
    const page = makeParsedPage(html);
    const result = await friction.audit(page);
    expect(result.score).toBe(100);
  });
});
```

Current test coverage:
- **71 tests** across 10 test suites
- Friction, structural, semantic, interaction, extraction, token-economics, temporal, multimodal auditors
- Runner orchestration tests
- CLI tests

---

## Troubleshooting

### "Error: Failed to fetch"
**Cause**: Network timeout or unreachable URL
**Solution**:
- Check if the URL is accessible in your browser
- Increase timeout: `--timeout 30000`
- Check firewall/proxy settings

### "Error: Fetch timeout"
**Cause**: Site takes too long to respond
**Solution**:
- Increase timeout: `--timeout 30000` or `--timeout 60000`
- Try at different time of day
- Site may be under load

### "HTTP 403 Forbidden"
**Cause**: User-Agent filtering or WAF blocking
**Solution**:
- This is actually what the audit detects!
- Try custom User-Agent: `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`
- This indicates the site has anti-bot measures

### "JSON output contains undefined values"
**Cause**: Some metadata fields may not be populated for all sites
**Solution**: This is expected. Check `hasJsonLd`, `hasWAF`, etc. for boolean flags.

### "Tests failing locally"
**Cause**: Bun version or environment differences
**Solution**:
```bash
# Update Bun to latest
bun upgrade

# Verify Bun version
bun --version

# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install

# Run tests
bun test
```

---

## Architecture Overview

```
CLI Entry (cli.ts)
  ↓
Argument Parser (hand-rolled)
  ↓
Runner (runAudit)
  ├→ Fetcher (fetchPage)
  │  └→ HTTP fetch + headers capture
  │
  ├→ Parser (parsePage)
  │  ├→ node-html-parser
  │  ├→ textContent extraction
  │  └→ Markdown estimation
  │
  └→ 8 Auditors (parallel via Promise.all)
     ├→ Friction (detects CAPTCHA, WAF, login walls)
     ├→ Structural (DOM depth, content ratio, SPA)
     ├→ Semantic (HTML semantics, labels, hierarchy)
     ├→ Interaction (forms, ARIA, accessibility)
     ├→ Extraction (JSON-LD, tables, pagination)
     ├→ Token Economics (cost estimation)
     ├→ Temporal (stability, A/B tests, classes)
     └→ Multimodal (alt text, contrast, focus)
        ↓
     Scoring & Grading
        ↓
     Report Generation
        ↓
Output Formatter (text/json/md)
```

**Key Design Decisions**:
- **Single fetch/parse**: All auditors share the same `ParsedPage` to avoid redundant fetches
- **Parallel auditors**: All 8 auditors run simultaneously via `Promise.all`
- **No heavy dependencies**: Only `node-html-parser` required; hand-rolled markdown estimation
- **Consistent scoring**: All auditors use same formula (start at 100, deduct per finding severity)
- **Weighted average**: Overall score is weighted sum of category scores

---

## Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **node-html-parser** | ^6.1.13 | Parse HTML for static analysis |
| **puppeteer** | ^22.0.0 | Headless browser automation |
| **puppeteer-extra** | ^3.3.6 | Puppeteer plugin framework |
| **puppeteer-extra-plugin-stealth** | ^2.11.2 | Anti-bot detection evasion |
| **@anthropic-ai/sdk** | ^0.28.0 | Claude API (LLM agent) |
| **openai** | ^4.60.0 | OpenAI API (GPT-4, compatible endpoints) |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **typescript** | ^5.4.0 | TypeScript compiler |
| **@types/bun** | latest | Bun type definitions |

### Runtime

- **Bun** (v1.3.10+) - JavaScript runtime with native APIs

### What Each Package Does

- **node-html-parser**: DOM parsing for static analysis (all 8 audit categories)
- **puppeteer**: Browser control for dynamic testing and navigation
- **puppeteer-extra**: Plugin system for anti-detection measures
- **puppeteer-extra-plugin-stealth**: Masks automation indicators (WebDriver, chrome object, etc.)
- **@anthropic-ai/sdk**: Claude API for LLM agent (task execution)
- **openai**: OpenAI API for GPT-4 and compatible services (task execution)

---

## Contributing / Extending

To add a new auditor:

1. Create `src/auditors/new-auditor.ts`
2. Implement `AuditorModule` interface:
   ```typescript
   export const myAuditor: AuditorModule = {
     category: "new-category" as AuditCategory,
     weight: 0.10,  // sum of all weights must = 1.0
     audit: async (page: ParsedPage) => {
       // Return CategoryScore
       return { ... };
     },
   };
   ```
3. Add to `runner.ts` `ALL_AUDITORS` array
4. Add tests in `tests/my-auditor.test.ts`
5. Update type definitions in `src/types.ts` if adding new category

---

## License

Built with ❤️ for analyzing websites for AI agent accessibility.

---

## Quick Reference

### Static Audit Commands

| Task | Command |
|------|---------|
| Basic audit | `bun run cli.ts https://example.com` |
| JSON output | `bun run cli.ts https://example.com --format json` |
| Markdown report | `bun run cli.ts https://example.com --format md --output report.md` |
| Specific categories | `bun run cli.ts https://example.com -c anti-agent-friction,token-economics` |
| Custom timeout | `bun run cli.ts https://example.com --timeout 30000` |

### Task Execution Commands

| Task | Command |
|------|---------|
| Basic task | `LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Find product"` |
| With stealth | `LLM_API_KEY=sk-ant-... bun run cli.ts task https://protected-site.com "Get data" --stealth` |
| With audit | `LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Test form" --with-audit` |
| JSON output | `LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Task" --format json` |
| Max steps | `LLM_API_KEY=sk-ant-... bun run cli.ts task https://example.com "Task" --max-steps 50` |

### Development Commands

| Task | Command |
|------|---------|
| Run tests | `bun test` |
| Watch tests | `bun test --watch` |
| Type check | `bun x tsc --noEmit` |
| Help | `bun run cli.ts --help` |
| Install deps | `bun install` |

---

**Ready to get started?**

**Static audit:**
```bash
bun run cli.ts https://github.com
```

**Dynamic test:**
```bash
export LLM_API_KEY=sk-ant-...
bun run cli.ts task https://github.com "Find a public repository"
```
