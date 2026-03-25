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
  format: "text" | "json" | "md";
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
      if (value === "text" || value === "json" || value === "md") {
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
  --format, -f            Output format: text | json | md        [default: text]
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

Environment Variables:
  LLM_API_KEY            Required for task execution
  LLM_PROVIDER           "claude" | "openai"                    [default: claude]
  LLM_MODEL              Default model ID
  LLM_BASE_URL           OpenAI-compatible endpoint (optional)

Examples:
  # Static audit
  axagent https://example.com
  axagent audit https://example.com --format json
  axagent https://example.com --categories anti-agent-friction,token-economics

  # Task execution
  LLM_API_KEY=sk-ant-... axagent task https://example.com "Find the cheapest item"
  LLM_API_KEY=sk-ant-... axagent task https://example.com "Fill out contact form" --format md

  # Task execution with stealth mode (circumvent bot protection)
  LLM_API_KEY=sk-ant-... axagent task https://protected-site.com "Find info" --stealth
  LLM_API_KEY=sk-ant-... axagent task https://cloudflare-site.com "Get data" --stealth --with-audit

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
