#!/usr/bin/env node
// Heart Failure Follow-Up Readiness Audit — CLI surface.
// Reuses the exact same scoring core as the web tool. Reads non-PHI workflow
// facts as JSON (from --input <file> or stdin) and prints the audit package.
//
//   npm run audit -- --example            # print an example facts file
//   npm run audit -- --input facts.json   # run the audit
//   cat facts.json | npm run audit        # or pipe via stdin
//   npm run audit -- --input facts.json --format memo   # plain-text memo
//
// Any coding agent (Claude Code, Codex, etc.) can call this directly.

import { readFileSync } from "node:fs";
import type { AuditFacts } from "../src/types";
import { runAudit } from "../src/lib/scoring";
import { auditPackage, memoText, agentPrompt } from "../src/lib/exports";
import { defaultFactSelections, DISCHARGES_DEFAULT } from "../src/data/questions";

const EXAMPLE: AuditFacts = {
  role: "pop",
  county: "allegheny",
  monthlyDischarges: DISCHARGES_DEFAULT,
  ...defaultFactSelections(),
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function loadFacts(): AuditFacts {
  const inputPath = arg("--input");
  const raw = inputPath ? readFileSync(inputPath, "utf8") : readStdin().trim();
  if (!raw) {
    console.error("No facts provided. Use --input <file>, pipe JSON via stdin, or --example.");
    process.exit(1);
  }
  return { ...EXAMPLE, ...JSON.parse(raw) } as AuditFacts;
}

function main() {
  if (process.argv.includes("--example")) {
    console.log(JSON.stringify(EXAMPLE, null, 2));
    return;
  }

  const result = runAudit(loadFacts());
  const format = arg("--format") ?? "json";

  if (format === "memo") console.log(memoText(result));
  else if (format === "prompt") console.log(agentPrompt(result));
  else console.log(JSON.stringify(auditPackage(result), null, 2));
}

main();
