# Heart Failure Follow-Up Readiness Audit

A public, non-PHI workflow diagnostic. In under five minutes, a care-management
leader or frontline operator answers a short operational audit and gets a
plain-language failure chain, a readiness score, and a result they can act on —
either a one-page brief to send upward (operator) or a scoped pilot brief
(risk owner).

It is the free, genuinely useful tool that opens a conversation. The contracted
pilot runs the same logic on attributed, compliant panel data.

## Two audiences, one engine

A role gate routes each visitor to the view built for them:

- **Operator** (nurse navigator / care manager): the 14-day failure map, where
  the workflow breaks, and a one-page brief to hand the person who owns the budget.
- **Risk owner** (ACO Medical Director, VP Population Health, Med Economics / CFO):
  the pilot brief, success measures, minimum contracted-data request, credibility
  guardrails, and a structured export.

The scoring engine is identical for both — only the framing differs.

## What it never does

No login. No backend. No database. No PHI. No fabricated savings, avoidable-
readmission, or patient-level ROI claims. Public data frames the question; it
never pretends to identify your patients or prove ROI.

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # scoring unit tests
npm run build      # type-check + production build to dist/
```

## Use it from an AI agent (CLI)

The same scoring core powers a CLI, so any coding agent can run the audit
locally — no account, no data leaves the machine:

```bash
npm run audit -- --example                      # print an example facts file
npm run audit -- --input facts.json             # run the audit -> JSON package
cat facts.json | npm run audit                  # or pipe via stdin
npm run audit -- --input facts.json --format memo     # plain-text pilot memo
npm run audit -- --input facts.json --format prompt   # ready-to-paste agent prompt
```

## Architecture

The audit logic lives in one pure, typed module so every surface shares the
same contract:

```
src/lib/scoring.ts     # facts in -> AuditResult out (the single source of truth)
src/lib/exports.ts     # JSON package, pilot memo, agent prompt
src/data/              # questions, copy, counties, role views, failure map
src/types.ts           # the shared contract
src/main.ts            # web UI (role gate + two views)
cli/audit.ts           # CLI surface (reuses scoring.ts)
```

An MCP server is a deliberate later step: it wraps the same core once the
scoring contract and buyer-facing language have stabilized.
