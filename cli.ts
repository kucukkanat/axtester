#!/usr/bin/env bun
import { runAudit } from "./src/runner.ts";
import type { AuditReport, AuditCategory } from "./src/types.ts";
import { runTask, runTaskWithAudit } from "./src/task/task-runner.ts";
import type { TaskReport, CombinedReport } from "./src/task-types.ts";
import { createAdapterFromEnv } from "./src/task/llm-adapter.ts";

const VERSION = "0.1.0";

type Command = "audit" | "task";

interface CliArgs {
  command: Command;
  url?: string;
  prompt?: string;
  format: "text" | "json" | "md" | "html";
  categories?: AuditCategory[];
  timeout?: number;
  userAgent?: string;
  output?: string;
  quiet: boolean;
  noColor: boolean;
  help: boolean;
  version: boolean;
  // Task-specific args
  model?: string;
  maxSteps?: number;
  withAudit: boolean;
  noScreenshots: boolean;
  // Stealth mode args
  stealth: boolean;
  stealthDelay: boolean;
  stealthMouse: boolean;
  stealthGeo: boolean;
  stealthUA: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: "audit",
    format: "text",
    quiet: false,
    noColor: false,
    help: false,
    version: false,
    withAudit: false,
    noScreenshots: false,
    stealth: false,
    stealthDelay: true,
    stealthMouse: true,
    stealthGeo: true,
    stealthUA: true,
  };

  // Skip first two elements: bun and script name
  const cliArgs = argv.slice(2);

  // Detect subcommand
  let i = 0;
  if (cliArgs[0] === "task" || cliArgs[0] === "audit") {
    args.command = cliArgs[0];
    i = 1;
  }

  // Check if first positional arg after subcommand looks like a URL
  let urlSet = false;

  while (i < cliArgs.length) {
    const arg = cliArgs[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      i++;
    } else if (arg === "--version") {
      args.version = true;
      i++;
    } else if (arg === "--format" || arg === "-f") {
      const value = cliArgs[++i];
      if (value === "text" || value === "json" || value === "md" || value === "html") {
        args.format = value;
      }
      i++;
    } else if (arg === "--categories" || arg === "-c") {
      const value = cliArgs[++i];
      args.categories = value.split(",").map((c) => c.trim() as AuditCategory);
      i++;
    } else if (arg === "--timeout") {
      args.timeout = parseInt(cliArgs[++i], 10);
      i++;
    } else if (arg === "--user-agent") {
      args.userAgent = cliArgs[++i];
      i++;
    } else if (arg === "--output" || arg === "-o") {
      args.output = cliArgs[++i];
      i++;
    } else if (arg === "--quiet" || arg === "-q") {
      args.quiet = true;
      i++;
    } else if (arg === "--no-color") {
      args.noColor = true;
      i++;
    } else if (arg === "--model") {
      args.model = cliArgs[++i];
      i++;
    } else if (arg === "--max-steps") {
      args.maxSteps = parseInt(cliArgs[++i], 10);
      i++;
    } else if (arg === "--with-audit") {
      args.withAudit = true;
      i++;
    } else if (arg === "--no-screenshots") {
      args.noScreenshots = true;
      i++;
    } else if (arg === "--stealth") {
      args.stealth = true;
      i++;
    } else if (arg === "--no-stealth-delay") {
      args.stealthDelay = false;
      i++;
    } else if (arg === "--no-stealth-mouse") {
      args.stealthMouse = false;
      i++;
    } else if (arg === "--no-stealth-geo") {
      args.stealthGeo = false;
      i++;
    } else if (arg === "--no-stealth-ua") {
      args.stealthUA = false;
      i++;
    } else if (arg.startsWith("--")) {
      // Unknown flag, skip
      i++;
    } else if (!arg.startsWith("-")) {
      // Positional arguments: URL and optional prompt for task
      if (!urlSet) {
        args.url = arg;
        urlSet = true;
      } else if (args.command === "task" && !args.prompt) {
        args.prompt = arg;
      }
      i++;
    } else {
      i++;
    }
  }

  return args;
}

function showHelp() {
  console.log(`
axagent - AI Agent Readiness Auditor

Usage:
  axagent [audit] <url> [options]
  axagent task <url> "<prompt>" [options]

Commands:
  audit                   Static analysis of website (default)
  task                    Dynamic browser-based task execution with LLM agent

Arguments (audit):
  url                     The URL to audit (required)

Arguments (task):
  url                     The URL to test (required)
  prompt                  Task description for agent (required)

Common Options:
  --format, -f            Output format: text | json | md | html  [default: text]
  --output, -o            Write report to file path
  --quiet, -q             Suppress all output except the report
  --no-color              Disable ANSI color output
  --timeout               Fetch timeout in milliseconds          [default: 15000]
  --help, -h              Show this help message
  --version               Print version

Audit-Specific Options:
  --categories, -c        Comma-separated category IDs           [default: all]
  --user-agent            Custom User-Agent string

Task-Specific Options:
  --model                 LLM model ID                           [env: LLM_MODEL]
  --max-steps             Maximum agent steps                    [default: 30]
  --with-audit            Include static audit in report
  --no-screenshots        Disable screenshot capture

Stealth Mode (Anti-Bot Detection):
  --stealth               Enable stealth mode for all sites
  --no-stealth-delay      Disable randomized delays
  --no-stealth-mouse      Disable mouse movement simulation
  --no-stealth-geo        Disable geolocation spoofing
  --no-stealth-ua         Disable User-Agent rotation

Environment Variables (opencode local instance):
  LLM_MODEL              Default model ID                        [default: claude-opus-4-5]
  LLM_PROVIDER_ID        Model provider ID                       [default: anthropic]
  LLM_MAX_TOKENS         Max tokens in response
  LLM_TEMPERATURE        Sampling temperature (0-1)
  LLM_SYSTEM_PROMPT      Custom system prompt

Notes:
  - Uses local opencode instance (no API keys needed)
  - Make sure opencode service is running locally
  - Model and provider must be available in your opencode setup

Examples:
  # Static audit
  axagent https://example.com
  axagent audit https://example.com --format json
  axagent https://example.com --categories anti-agent-friction,token-economics

  # Task execution (with default local opencode)
  axagent task https://example.com "Find the cheapest item"
  axagent task https://example.com "Fill out contact form" --format md

  # Task execution with custom model
  LLM_MODEL=claude-sonnet-4 axagent task https://example.com "Find info"

  # Task execution with stealth mode (circumvent bot protection)
  axagent task https://protected-site.com "Find info" --stealth
  axagent task https://cloudflare-site.com "Get data" --stealth --with-audit

Category IDs (for static audit):
  - structural-parsability
  - semantic-clarity
  - interaction-surface
  - anti-agent-friction
  - data-extraction-quality
  - token-economics
  - temporal-stability
  - multimodal-readiness
`);
}

function formatTextReport(
  report: AuditReport,
  useColor: boolean
): string {
  const c = useColor ? colors : noColors;

  const scoreBar =
    report.overallScore >= 85
      ? `${c.green}████████████████████${c.reset}`
      : report.overallScore >= 70
        ? `${c.blue}████████████████${c.reset}    `
        : report.overallScore >= 55
          ? `${c.yellow}████████████${c.reset}        `
          : report.overallScore >= 40
            ? `${c.orange}████████${c.reset}            `
            : `${c.red}████${c.reset}                `;

  let output = `\n${c.bold}axagent audit:${c.reset} ${report.url}\n`;
  output += `${c.dim}Fetched in ${report.durationMs}ms${c.reset}\n\n`;

  output += `${c.bold}Overall Score:${c.reset} ${scoreBar} ${report.overallScore}/100 (${report.grade})\n`;
  output += `${c.dim}${report.summary}${c.reset}\n\n`;

  output += `${c.bold}Category Breakdown:${c.reset}\n`;
  output += `${"─".repeat(80)}\n`;

  for (const cat of report.categories) {
    const gradeEmoji =
      cat.score >= 85 ? "🟢" : cat.score >= 70 ? "🔵" : cat.score >= 55 ? "🟡" : "🔴";
    const catName = cat.category
      .replace(/([A-Z])/g, " $1")
      .replace(/-/g, " ")
      .trim()
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const topFinding = cat.findings[0];
    const findingText = topFinding
      ? `${topFinding.message.slice(0, 40)}${topFinding.message.length > 40 ? "..." : ""}`
      : "✓ No issues";

    output += `${gradeEmoji} ${catName.padEnd(35)} ${cat.score.toString().padEnd(3)}/100  ${findingText}\n`;
  }

  output += `${"─".repeat(80)}\n\n`;

  return output;
}

function formatJsonReport(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

function formatMdReport(report: AuditReport): string {
  let output = `# AI Agent Readiness Audit Report\n\n`;
  output += `**URL:** ${report.url}\n`;
  output += `**Date:** ${report.fetchedAt}\n`;
  output += `**Overall Score:** ${report.overallScore}/100 (Grade: ${report.grade})\n\n`;

  output += `## Summary\n\n${report.summary}\n\n`;

  output += `## Category Scores\n\n`;
  output += `| Category | Score | Grade |\n`;
  output += `|----------|-------|-------|\n`;

  for (const cat of report.categories) {
    const catName = cat.category.replace(/-/g, " ");
    const grade =
      cat.score >= 85
        ? "A"
        : cat.score >= 70
          ? "B"
          : cat.score >= 55
            ? "C"
            : cat.score >= 40
              ? "D"
              : "F";
    output += `| ${catName} | ${cat.score}/100 | ${grade} |\n`;
  }

  output += `\n## Findings by Category\n\n`;

  for (const cat of report.categories) {
    output += `### ${cat.category.replace(/-/g, " ")}\n\n`;
    output += `**Score:** ${cat.score}/100\n\n`;

    if (cat.findings.length === 0) {
      output += `No findings.\n\n`;
    } else {
      for (const finding of cat.findings) {
        const severityEmoji =
          finding.severity === "critical"
            ? "🔴"
            : finding.severity === "warning"
              ? "🟠"
              : finding.severity === "info"
                ? "🔵"
                : "✅";
        output += `${severityEmoji} **${finding.message}**\n`;
        if (finding.detail) {
          output += `- *Detail:* ${finding.detail}\n`;
        }
        if (finding.recommendation) {
          output += `- *Recommendation:* ${finding.recommendation}\n`;
        }
        output += `\n`;
      }
    }
  }

  return output;
}

function formatHtmlReport(report: AuditReport): string {
  const gradeColor = (score: number) => {
    if (score >= 85) return "#00d4aa";
    if (score >= 70) return "#7dd87d";
    if (score >= 55) return "#ffcc00";
    if (score >= 40) return "#ff6b35";
    return "#ff3b5c";
  };

  const gradeBg = (score: number) => {
    if (score >= 85) return "rgba(0,212,170,.15)";
    if (score >= 70) return "rgba(125,216,125,.15)";
    if (score >= 55) return "rgba(255,204,0,.15)";
    if (score >= 40) return "rgba(255,107,53,.15)";
    return "rgba(255,59,92,.15)";
  };

  const getGrade = (score: number) => {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  };

  const findingColor = (severity: string) => {
    if (severity === "critical") return "bad";
    if (severity === "warning") return "warn";
    if (severity === "info") return "info";
    return "good";
  };

  const findingIcon = (severity: string) => {
    if (severity === "critical") return "🔴";
    if (severity === "warning") return "🟠";
    if (severity === "info") return "🔵";
    return "✅";
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Readiness Audit — ${new URL(report.url).hostname}</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0a0c10;--surface:#12151c;--surface2:#1a1e28;--border:#242a38;
  --text:#e4e8f0;--text-dim:#8891a5;--text-muted:#5a6378;
  --accent:#00d4aa;--accent2:#0099ff;--warn:#ff6b35;--fail:#ff3b5c;--good:#00d4aa;
  --grade-a:#00d4aa;--grade-b:#7dd87d;--grade-c:#ffcc00;--grade-d:#ff6b35;--grade-f:#ff3b5c;
}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
.mono{font-family:'JetBrains Mono',monospace}
.hero{padding:60px 40px 40px;max-width:1200px;margin:0 auto;position:relative}
.badge{display:inline-flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:6px 16px;font-size:12px;color:var(--accent);margin-bottom:20px;font-weight:500;letter-spacing:.5px;text-transform:uppercase}
.hero h1{font-size:clamp(32px,5vw,56px);font-weight:700;line-height:1.1;margin-bottom:12px;background:linear-gradient(135deg,var(--text),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.subtitle{font-size:18px;color:var(--text-dim);max-width:640px}
.meta-row{display:flex;gap:32px;margin-top:24px;flex-wrap:wrap}
.meta-item{font-size:13px;color:var(--text-muted)}
.meta-item span{color:var(--text);font-weight:500}
.score-hero{display:flex;align-items:center;gap:48px;padding:40px;margin:0 40px;max-width:1120px;background:var(--surface);border:1px solid var(--border);border-radius:16px;position:relative;overflow:hidden}
.score-ring{position:relative;width:160px;height:160px;flex-shrink:0}
.score-ring svg{transform:rotate(-90deg)}
.score-ring .track{fill:none;stroke:var(--surface2);stroke-width:8}
.score-ring .fill{fill:none;stroke:var(--accent);stroke-width:8;stroke-linecap:round;stroke-dasharray:440;stroke-dashoffset:calc(440 - (440 * var(--pct) / 100));transition:stroke-dashoffset 1.5s ease}
.score-val{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.score-val .num{font-size:48px;font-weight:700;color:var(--accent);line-height:1}
.score-val .of{font-size:14px;color:var(--text-muted)}
.score-detail h2{font-size:28px;font-weight:700;margin-bottom:8px}
.grade{display:inline-block;padding:4px 12px;border-radius:6px;font-size:14px;font-weight:700;margin-left:12px}
.pill{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600}
.score-detail p{color:var(--text-dim);font-size:15px;max-width:520px}
.cats{max-width:1200px;margin:40px auto;padding:0 40px}
.cats h2{font-size:24px;font-weight:700;margin-bottom:24px;display:flex;align-items:center;gap:12px}
.line{flex:1;height:1px;background:var(--border)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;position:relative;overflow:hidden;transition:border-color .2s}
.card:hover{border-color:var(--accent)}
.card-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.card-top h3{font-size:16px;font-weight:600}
.weight{font-size:12px;color:var(--text-muted);background:var(--surface2);padding:3px 10px;border-radius:10px}
.card-score{display:flex;align-items:baseline;gap:6px;margin-bottom:12px}
.big{font-size:36px;font-weight:700;line-height:1}
.bar-bg{height:6px;background:var(--surface2);border-radius:3px;margin-bottom:16px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;transition:width 1.2s ease}
.findings{list-style:none;font-size:13px;color:var(--text-dim)}
.findings li{padding:4px 0;display:flex;align-items:flex-start;gap:8px}
.findings li::before{content:'';width:4px;height:4px;border-radius:50%;margin-top:8px;flex-shrink:0}
.findings .good::before{background:var(--good)}
.findings .warn::before{background:var(--warn)}
.findings .bad::before{background:var(--fail)}
.findings .info::before{background:var(--accent2)}
.summary{max-width:1200px;margin:40px auto;padding:0 40px}
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl th{text-align:left;padding:12px 16px;color:var(--text-muted);font-weight:500;border-bottom:1px solid var(--border);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.tbl td{padding:12px 16px;border-bottom:1px solid rgba(36,42,56,.5)}
.tbl tr:hover td{background:rgba(0,212,170,.02)}
.verdict{max-width:1200px;margin:40px auto 60px;padding:0 40px}
.verdict-box{background:linear-gradient(135deg,var(--surface),var(--surface2));border:1px solid var(--border);border-radius:16px;padding:40px}
.foot{text-align:center;padding:40px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border)}
@media(max-width:768px){.hero,.cats,.summary,.verdict{padding-left:20px;padding-right:20px}.score-hero{flex-direction:column;margin:0 20px;gap:24px;text-align:center}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="hero">
  <div class="badge">🔍 Live Audit Report</div>
  <h1>Agent Readiness Audit</h1>
  <p class="subtitle">How ready is <strong>${new URL(report.url).hostname}</strong> for autonomous AI agents? An accessibility test — not for humans, but for machines.</p>
  <div class="meta-row">
    <div class="meta-item">Target: <span>${report.url}</span></div>
    <div class="meta-item">Date: <span>${new Date(report.fetchedAt).toLocaleDateString()}</span></div>
    <div class="meta-item">Categories: <span>${report.categories.length}</span></div>
    <div class="meta-item">Duration: <span>${report.durationMs}ms</span></div>
  </div>
</div>

<div class="score-hero" style="--pct:${report.overallScore}">
  <div class="score-ring">
    <svg viewBox="0 0 160 160" width="160" height="160">
      <circle class="track" cx="80" cy="80" r="70"/>
      <circle class="fill" cx="80" cy="80" r="70"/>
    </svg>
    <div class="score-val">
      <span class="num">${report.overallScore}</span>
      <span class="of">/ 100</span>
    </div>
  </div>
  <div class="score-detail">
    <h2>Weighted Score<span class="grade pill" style="background:${gradeBg(report.overallScore)};color:${gradeColor(report.overallScore)}">${getGrade(report.overallScore)}</span></h2>
    <p>${report.summary}</p>
  </div>
</div>

<div class="cats">
  <h2>Category Breakdown <span class="line"></span></h2>
  <div class="grid">
`;

  for (const cat of report.categories) {
    const color = gradeColor(cat.score);
    const bg = gradeBg(cat.score);
    const grade = getGrade(cat.score);
    const catName = cat.category.replace(/-/g, " ");

    html += `    <div class="card">
      <div class="card-top"><h3>${catName}</h3><span class="weight mono">${(cat.weight * 100).toFixed(0)}%</span></div>
      <div class="card-score">
        <span class="big" style="color:${color}">${cat.score}</span>
        <span class="pill" style="background:${bg};color:${color}">${grade}</span>
      </div>
      <div class="bar-bg"><div class="bar-fill" style="width:${cat.score}%;background:${color}"></div></div>
      <ul class="findings">
`;

    if (cat.findings.length === 0) {
      html += `        <li class="good">✓ No issues detected</li>\n`;
    } else {
      for (const finding of cat.findings) {
        const fColor = findingColor(finding.severity);
        html += `        <li class="${fColor}">${findingIcon(finding.severity)} ${finding.message}</li>\n`;
      }
    }

    html += `      </ul>
    </div>\n`;
  }

  html += `  </div>
</div>

<div class="summary">
  <h2>Score Summary <span class="line"></span></h2>
  <table class="tbl">
    <thead>
      <tr>
        <th>Category</th>
        <th>Weight</th>
        <th>Score</th>
        <th>Grade</th>
        <th>Weighted</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const cat of report.categories) {
    const weighted = (cat.score * cat.weight).toFixed(2);
    const color = gradeColor(cat.score);
    const bg = gradeBg(cat.score);
    const grade = getGrade(cat.score);
    const catName = cat.category.replace(/-/g, " ");

    html += `      <tr><td>${catName}</td><td class="mono">${(cat.weight * 100).toFixed(0)}%</td><td class="mono">${cat.score}</td><td><span class="pill" style="background:${bg};color:${color}">${grade}</span></td><td class="mono">${weighted}</td></tr>\n`;
  }

  html += `    </tbody>
  </table>
</div>

<div class="verdict">
  <div class="verdict-box">
    <h2>Verdict</h2>
    <p>${report.summary}</p>
  </div>
</div>

<div class="foot">
  <p>Generated by <strong>axagent</strong> — AI Agent Readiness Auditor | ${new Date(report.fetchedAt).toISOString()}</p>
</div>
</body>
</html>`;

  return html;
}

function formatTaskTextReport(
  report: TaskReport,
  useColor: boolean
): string {
  const c = useColor ? colors : noColors;

  const outcomeEmoji =
    report.finalOutcome === "completed"
      ? "✅"
      : report.finalOutcome === "partial"
        ? "⚠️"
        : report.finalOutcome === "failed"
          ? "❌"
          : "🚫";

  const scoreBar =
    report.score.overall >= 85
      ? `${c.green}████████████████████${c.reset}`
      : report.score.overall >= 70
        ? `${c.blue}████████████████${c.reset}    `
        : report.score.overall >= 55
          ? `${c.yellow}████████████${c.reset}        `
          : report.score.overall >= 40
            ? `${c.orange}████████${c.reset}            `
            : `${c.red}████${c.reset}                `;

  let output = `\n${c.bold}axagent task execution:${c.reset} ${report.url}\n`;
  output += `${c.dim}Prompt: ${report.prompt}\n`;
  output += `Duration: ${report.durationMs}ms | Model: ${report.modelId}${c.reset}\n\n`;

  output += `${outcomeEmoji} ${c.bold}Outcome:${c.reset} ${report.finalOutcome.toUpperCase()}\n`;
  output += `${c.bold}Score:${c.reset} ${scoreBar} ${report.score.overall}/100\n\n`;

  if (report.agentAnswer) {
    output += `${c.bold}Agent Found:${c.reset} ${report.agentAnswer}\n\n`;
  }

  if (report.barriersEncountered.length > 0) {
    output += `${c.bold}Barriers Encountered (${report.barriersEncountered.length}):${c.reset}\n`;
    for (const barrier of report.barriersEncountered) {
      const emoji =
        barrier.type === "captcha"
          ? "🤖"
          : barrier.type === "login-wall"
            ? "🔒"
            : barrier.type === "rate-limit"
              ? "🚦"
              : "⚠️";
      output += `${emoji} ${barrier.type}: ${barrier.description}\n`;
    }
    output += "\n";
  }

  if (report.agentReadinessInsights.length > 0) {
    output += `${c.bold}Insights:${c.reset}\n`;
    for (const insight of report.agentReadinessInsights) {
      output += `${insight}\n`;
    }
    output += "\n";
  }

  output += `${c.dim}Steps: ${report.totalSteps} | Tokens: ${report.totalInputTokens + report.totalOutputTokens}`;
  if (report.estimatedCostUsd) {
    output += ` | Est. Cost: $${report.estimatedCostUsd.toFixed(4)}`;
  }
  output += `${c.reset}\n`;

  return output;
}

function formatTaskJsonReport(report: TaskReport | CombinedReport): string {
  return JSON.stringify(report, null, 2);
}

function formatTaskMdReport(report: TaskReport): string {
  let output = `# Task Execution Report\n\n`;
  output += `**URL:** ${report.url}\n`;
  output += `**Prompt:** ${report.prompt}\n`;
  output += `**Model:** ${report.modelId}\n`;
  output += `**Date:** ${report.completedAt}\n`;
  output += `**Duration:** ${report.durationMs}ms\n\n`;

  output += `## Outcome\n\n`;
  output += `**Status:** ${report.finalOutcome.toUpperCase()}\n`;
  output += `**Score:** ${report.score.overall}/100\n`;

  if (report.agentAnswer) {
    output += `**Answer:** ${report.agentAnswer}\n`;
  }

  output += `\n## Metrics\n\n`;
  output += `| Metric | Value |\n`;
  output += `|--------|-------|\n`;
  output += `| Completion Rate | ${report.score.completionRate}% |\n`;
  output += `| Efficiency | ${report.score.efficiency}/100 |\n`;
  output += `| Barrier Penalty | ${report.score.barrierPenalty}/100 |\n`;
  output += `| Total Steps | ${report.totalSteps} |\n`;
  output += `| Input Tokens | ${report.totalInputTokens} |\n`;
  output += `| Output Tokens | ${report.totalOutputTokens} |\n`;
  if (report.estimatedCostUsd) {
    output += `| Estimated Cost | $${report.estimatedCostUsd.toFixed(4)} |\n`;
  }
  output += `\n`;

  if (report.barriersEncountered.length > 0) {
    output += `## Barriers Encountered\n\n`;
    for (const barrier of report.barriersEncountered) {
      output += `- **${barrier.type}**: ${barrier.description}\n`;
    }
    output += "\n";
  }

  if (report.agentReadinessInsights.length > 0) {
    output += `## Insights\n\n`;
    for (const insight of report.agentReadinessInsights) {
      output += `${insight}\n\n`;
    }
  }

  return output;
}

function formatCombinedMdReport(report: CombinedReport): string {
  let output = `# AI Agent Readiness Report\n\n`;
  output += `**URL:** ${report.url}\n`;
  output += `**Generated:** ${report.generatedAt}\n\n`;

  output += `## Static Audit\n\n`;
  output += formatMdReport(report.staticAudit);

  output += `\n## Dynamic Task Execution\n\n`;
  output += formatTaskMdReport(report.taskExecution);

  if (report.correlations.length > 0) {
    output += `## Audit-Barrier Correlations\n\n`;
    for (const corr of report.correlations) {
      output += `- **${corr.barrierType}** ↔ *${corr.auditCategory}*: ${corr.explanation}\n`;
    }
  }

  return output;
}

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  orange: "\x1b[33m", // Using yellow as fallback
};

const noColors = {
  reset: "",
  bold: "",
  dim: "",
  red: "",
  green: "",
  yellow: "",
  blue: "",
  orange: "",
};

async function main() {
  const args = parseArgs(Bun.argv);

  if (args.version) {
    console.log(`axagent v${VERSION}`);
    return;
  }

  if (args.help) {
    showHelp();
    return;
  }

  if (!args.url) {
    showHelp();
    throw new Error("URL is required");
  }

  try {
    if (args.command === "task") {
      // Task execution mode
      if (!args.prompt) {
        showHelp();
        throw new Error("Prompt is required for task execution");
      }

      if (!args.quiet) {
        console.error(`🤖 Running task on ${args.url}...`);
        console.error(`📝 Prompt: ${args.prompt}`);
      }

      // Create LLM adapter from environment
      const llmAdapter = createAdapterFromEnv();

      // Override model if specified
      if (args.model) {
        // Note: Would need to recreate adapter with new model
        // For now, rely on env variable
      }

      // Build stealth configuration
      const stealthConfig = args.stealth
        ? {
            enabled: true,
            randomizeDelay: args.stealthDelay,
            randomizeMouse: args.stealthMouse,
            spoofGeolocation: args.stealthGeo,
            rotateUserAgent: args.stealthUA,
            minDelay: 800,
            maxDelay: 3000,
            disableHeadlessIndicators: true,
          }
        : { enabled: false };

      let output: string;

      if (args.withAudit) {
        // Run combined task + audit
        const report = await runTaskWithAudit(args.url, {
          prompt: args.prompt,
          maxSteps: args.maxSteps,
          timeoutMs: args.timeout || 120000,
          screenshotsEnabled: !args.noScreenshots,
          llmAdapter,
          includeStaticAudit: true,
          stealth: stealthConfig,
        });

        if (args.format === "json") {
          output = formatTaskJsonReport(report);
        } else if (args.format === "md") {
          output = formatCombinedMdReport(report);
        } else {
          output = formatTaskTextReport(report.taskExecution, !args.noColor);
          output += "\n\n---\n\n";
          output += formatTextReport(report.staticAudit, !args.noColor);
        }
      } else {
        // Run task only
        const report = await runTask(args.url, {
          prompt: args.prompt,
          maxSteps: args.maxSteps,
          timeoutMs: args.timeout || 120000,
          screenshotsEnabled: !args.noScreenshots,
          llmAdapter,
          stealth: stealthConfig,
        });

        if (args.format === "json") {
          output = formatTaskJsonReport(report);
        } else if (args.format === "md") {
          output = formatTaskMdReport(report);
        } else {
          output = formatTaskTextReport(report, !args.noColor);
        }
      }

      if (args.output) {
        await Bun.write(args.output, output);
        if (!args.quiet) {
          console.error(`✅ Report written to ${args.output}`);
        }
      } else {
        console.log(output);
      }
    } else {
      // Audit mode (default)
      if (!args.quiet) {
        console.error(`🔍 Auditing ${args.url}...`);
      }

      const report = await runAudit(args.url, {
        categories: args.categories,
        fetchOptions: {
          timeoutMs: args.timeout || 15000,
          userAgent: args.userAgent,
        },
      });

      let output: string;

      if (args.format === "json") {
        output = formatJsonReport(report);
      } else if (args.format === "md") {
        output = formatMdReport(report);
      } else if (args.format === "html") {
        output = formatHtmlReport(report);
      } else {
        output = formatTextReport(report, !args.noColor);
      }

      if (args.output) {
        await Bun.write(args.output, output);
        if (!args.quiet) {
          console.error(`✅ Report written to ${args.output}`);
        }
      } else {
        console.log(output);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(
      `${colors.red}✗ Error: ${message}${colors.reset}`
    );
    throw error;
  }
}

main().catch((error) => {
  // Handle errors
  if (!colors.red) console.error("Error:", error);
  process.exit(1);
});
