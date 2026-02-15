#!/usr/bin/env tsx
/**
 * DealFlow Autonomous Audit Script
 *
 * Scans the codebase by area, sends each area to Claude API for review,
 * aggregates findings, and creates a GitHub Issue with prioritized results.
 *
 * Usage:
 *   npx tsx scripts/autonomous-audit.ts           # Local run (prints to stdout)
 *   npx tsx scripts/autonomous-audit.ts --github   # Creates GitHub Issue
 *
 * Environment Variables:
 *   ANTHROPIC_API_KEY  - Required: Claude API key
 *   GITHUB_TOKEN       - Required for --github: GitHub token with issues:write
 *   REPO_OWNER         - Required for --github: Repository owner
 *   REPO_NAME          - Required for --github: Repository name
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import {
  SYSTEM_CONTEXT,
  AUDIT_PROMPTS,
  type AuditFinding,
  type AuditAreaResult,
  type AuditReport,
} from "./audit-prompts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 15_000; // Max chars per file to include
const MAX_AREA_TOKENS = 80_000; // Rough char budget per area (~20K tokens)
const MODEL = "claude-sonnet-4-20250514";
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// File Collection
// ---------------------------------------------------------------------------

function collectFiles(patterns: string[]): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const matches = globSync(pattern, { cwd: PROJECT_ROOT, nodir: true });
    for (const match of matches) {
      if (seen.has(match)) continue;
      seen.add(match);

      const fullPath = path.join(PROJECT_ROOT, match);
      try {
        let content = fs.readFileSync(fullPath, "utf8");
        if (content.length > MAX_FILE_SIZE) {
          content = content.slice(0, MAX_FILE_SIZE) + "\n\n// ... truncated ...";
        }
        files.push({ path: match, content });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return files;
}

function buildFileContext(
  files: { path: string; content: string }[]
): string {
  let context = "";
  let charCount = 0;

  for (const file of files) {
    const block = `\n--- ${file.path} ---\n${file.content}\n`;
    if (charCount + block.length > MAX_AREA_TOKENS) {
      context += `\n\n(${files.length - files.indexOf(file)} more files omitted due to size limits)`;
      break;
    }
    context += block;
    charCount += block.length;
  }

  return context;
}

// ---------------------------------------------------------------------------
// Claude API Review
// ---------------------------------------------------------------------------

async function reviewArea(
  client: Anthropic,
  area: (typeof AUDIT_PROMPTS)[number],
  fileContext: string
): Promise<AuditAreaResult> {
  console.log(`  Reviewing ${area.label}...`);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_CONTEXT,
      messages: [
        {
          role: "user",
          content: `${area.prompt}\n\n## Files to Review\n${fileContext}\n\n## Response Format
Respond with a JSON object:
{
  "summary": "One paragraph summary of the area's health",
  "findings": [
    {
      "file": "src/...",
      "line": "optional line reference",
      "severity": "info" | "warning" | "critical",
      "message": "Description of the issue",
      "suggestedFix": "How to fix it"
    }
  ],
  "praise": ["List of things done well in this area"]
}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        area: area.area,
        label: area.label,
        summary: "Could not parse review response",
        findings: [],
        praise: [],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      area: area.area,
      label: area.label,
      summary: parsed.summary || "",
      findings: (parsed.findings || []) as AuditFinding[],
      praise: parsed.praise || [],
    };
  } catch (err: any) {
    console.error(`  Error reviewing ${area.label}:`, err.message);
    return {
      area: area.area,
      label: area.label,
      summary: `Review failed: ${err.message}`,
      findings: [],
      praise: [],
    };
  }
}

// ---------------------------------------------------------------------------
// GitHub Issue Creation
// ---------------------------------------------------------------------------

async function createGitHubIssue(report: AuditReport): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;

  if (!token || !owner || !repo) {
    console.log("GitHub credentials not configured, skipping issue creation");
    return null;
  }

  const date = new Date().toISOString().split("T")[0];
  const title = `[Autonomous Audit] ${date} — ${report.criticalCount} critical, ${report.warningCount} warnings`;

  let body = `# DealFlow Autonomous Audit Report\n\n`;
  body += `**Date:** ${report.timestamp}\n`;
  body += `**Files Scanned:** ${report.totalFiles}\n`;
  body += `**Model:** ${MODEL}\n\n`;
  body += `| Severity | Count |\n|---|---|\n`;
  body += `| :x: Critical | ${report.criticalCount} |\n`;
  body += `| :warning: Warning | ${report.warningCount} |\n`;
  body += `| :information_source: Info | ${report.infoCount} |\n\n`;
  body += `---\n\n`;

  for (const area of report.areas) {
    body += `## ${area.label}\n\n`;
    body += `${area.summary}\n\n`;

    if (area.findings.length > 0) {
      body += `### Findings\n\n`;
      // Sort: critical first, then warning, then info
      const sorted = [...area.findings].sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
      });

      for (const f of sorted) {
        const emoji =
          f.severity === "critical"
            ? ":x:"
            : f.severity === "warning"
              ? ":warning:"
              : ":information_source:";
        body += `${emoji} **\`${f.file}\`**${f.line ? ` (${f.line})` : ""}\n`;
        body += `> ${f.message}\n`;
        if (f.suggestedFix) {
          body += `> **Fix:** ${f.suggestedFix}\n`;
        }
        body += `\n`;
      }
    }

    if (area.praise.length > 0) {
      body += `### :star2: Well Done\n\n`;
      for (const p of area.praise) {
        body += `- ${p}\n`;
      }
      body += `\n`;
    }

    body += `---\n\n`;
  }

  body += `\n_Generated by DealFlow Autonomous Audit | Claude ${MODEL}_\n`;

  // Create issue via GitHub API
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        title,
        body,
        labels: ["autonomous-audit", "ai-review"],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to create GitHub issue:", error);
    return null;
  }

  const issue = (await response.json()) as { html_url: string };
  return issue.html_url;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== DealFlow Autonomous Audit ===\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is required");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const useGitHub =
    process.argv.includes("--github") || !!process.env.GITHUB_TOKEN;

  // Read CLAUDE.md for additional context
  const claudeMdPath = path.join(PROJECT_ROOT, "CLAUDE.md");
  const claudeMd = fs.existsSync(claudeMdPath)
    ? fs.readFileSync(claudeMdPath, "utf8")
    : "";

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    totalFiles: 0,
    areas: [],
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
  };

  // Process each audit area
  for (const area of AUDIT_PROMPTS) {
    console.log(`\nScanning ${area.label} (${area.filePatterns.join(", ")})...`);

    const files = collectFiles(area.filePatterns);
    report.totalFiles += files.length;

    if (files.length === 0) {
      console.log(`  No files found, skipping`);
      continue;
    }

    console.log(`  Found ${files.length} files`);
    const fileContext = buildFileContext(files);
    const result = await reviewArea(client, area, fileContext);

    report.areas.push(result);

    // Count findings
    for (const f of result.findings) {
      if (f.severity === "critical") report.criticalCount++;
      else if (f.severity === "warning") report.warningCount++;
      else report.infoCount++;
    }

    // Rate limit: pause between API calls
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log("\n=== Audit Summary ===");
  console.log(`Files scanned: ${report.totalFiles}`);
  console.log(
    `Critical: ${report.criticalCount} | Warning: ${report.warningCount} | Info: ${report.infoCount}`
  );

  if (useGitHub) {
    console.log("\nCreating GitHub Issue...");
    const issueUrl = await createGitHubIssue(report);
    if (issueUrl) {
      console.log(`Issue created: ${issueUrl}`);
    }
  } else {
    // Print report to stdout for local runs
    console.log("\n=== Full Report ===\n");
    for (const area of report.areas) {
      console.log(`## ${area.label}`);
      console.log(area.summary);
      if (area.findings.length > 0) {
        console.log("\nFindings:");
        for (const f of area.findings) {
          console.log(
            `  [${f.severity.toUpperCase()}] ${f.file}${f.line ? `:${f.line}` : ""}`
          );
          console.log(`    ${f.message}`);
          if (f.suggestedFix) console.log(`    Fix: ${f.suggestedFix}`);
        }
      }
      if (area.praise.length > 0) {
        console.log("\nPraise:");
        for (const p of area.praise) {
          console.log(`  + ${p}`);
        }
      }
      console.log();
    }
  }

  // Exit with error if critical issues found (useful for CI)
  if (report.criticalCount > 0) {
    console.log(
      `\n:x: ${report.criticalCount} critical issues found. Review required.`
    );
    process.exit(1);
  }

  console.log("\n:white_check_mark: Audit complete. No critical issues.");
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
