---
name: trace-bug
description: Disciplined bug diagnosis loop for hard bugs and performance regressions. Use when user reports something broken, throwing, failing, or slow. Follows: feedback loop → reproduce → hypothesise → instrument → fix → cleanup.
license: MIT
compatibility: opencode
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

## Phase 1 — Build a Feedback Loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug, you will find the cause. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here.

### Ways to construct one

1. **Failing test** at whatever seam reaches the bug
2. **Curl / HTTP script** against a running dev server
3. **CLI invocation** with a fixture input, diffing stdout
4. **Headless browser script** (Playwright/Puppeteer)
5. **Replay a captured trace** — save real request/event log
6. **Throwaway harness** — minimal subset that exercises the bug
7. **Bisection harness** — automate boot at state X, check, repeat

### Tighten the loop

- Can I make it faster? (Cache setup, skip unrelated init)
- Can I make the signal sharper? (Assert on specific symptom)
- Can I make it more deterministic? (Pin time, seed RNG)

### Completion Criterion

Phase 1 is done when the loop is **tight** and **red-capable**:
- Drives the actual bug code path and asserts the user's exact symptom
- Deterministic — same verdict every run
- Fast — seconds, not minutes
- Agent-runnable — you can run it unattended

If you catch yourself reading code to build a theory before this command exists, **stop.**

## Phase 2 — Reproduce + Minimise

Run the loop. Watch it go red.

Confirm:
- The loop produces the failure mode the **user** described
- The failure is reproducible across multiple runs

**Minimise:** Shrink the repro to the smallest scenario that still goes red. Cut inputs, callers, config, data one at a time.

Done when every remaining element is load-bearing — removing any makes it go green.

## Phase 3 — Hypothesise

Generate 3-5 ranked hypotheses before testing any. Each must be falsifiable.

> Format: "If X is the cause, then changing Y will make the bug disappear"

Show the ranked list to the user before testing.

## Phase 4 — Instrument

Each probe maps to a specific prediction from Phase 3. Change one variable at a time.

1. Debugger/REPL if env supports
2. Targeted logs at boundaries that distinguish hypotheses
3. Never "log everything and grep"

Tag every debug log with prefix like `[DEBUG-a4f2]`.

## Phase 5 — Fix + Regression Test

1. Turn the minimised repro into a failing test at a correct seam
2. Watch it fail
3. Apply the fix
4. Watch it pass
5. Re-run the Phase 1 feedback loop against original scenario

## Phase 6 — Cleanup + Post-Mortem

Before declaring done:
- Original repro no longer reproduces
- Regression test passes
- All debug instrumentation removed
- The correct hypothesis is stated in commit/PR message

Then ask: what would have prevented this bug?

## Workspace Integration

**Related rules:** `.opencode/rules/testing.md` (quality gates), `.opencode/rules/coding.md`
**Related workflow:** `.opencode/workflows/bugfix.md`
**Related agents:** `@developer`, `@researcher`
**Related skills:** `debug`, `verify-completion`, `tdd`
