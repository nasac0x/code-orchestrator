---
name: tdd
description: Test-driven development with RED-GREEN-REFACTOR cycle. Use when building features or fixing bugs test-first. Load BEFORE writing implementation code. Enforces failing test before any production code.
license: MIT
compatibility: opencode
---

# Test-Driven Development

TDD is the red → green loop. Every section applies on every cycle. Consult them before and during the loop, not after.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification and survives refactors because it doesn't care about internal structure.

## Seams — where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam.

Ask: "What's the public interface, and which seams should we test?"

## Anti-Patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods. The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological** — assertion recomputes the expected value the way the code does, so it passes by construction. Expected values must come from an independent source.
- **Horizontal slicing** — writing all tests first, then all implementation. Work in **vertical slices**: one test → one implementation → repeat.

## Rules of the Loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage.

## Workspace Integration

**Related rules:** `.opencode/rules/testing.md` (quality gates), `.opencode/rules/coding.md`
**Related workflow:** `.opencode/workflows/feature.md` (Stage 2: Test Planning)
**Related agents:** `@developer`, `@tester`
**Related skills:** `verify-completion`, `code-review`

**Quality Gates (`.opencode/rules/testing.md`):**
- Each test cycle must satisfy Gate 2: Tests pass
- Each implementation must satisfy Gate 3: Code Quality
- Full suite must pass before merging (Gate 2)
