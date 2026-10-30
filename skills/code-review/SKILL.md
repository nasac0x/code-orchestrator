---
name: code-review
description: Two-axis code review — Standards (does code follow coding standards?) and Spec (does code match requirements?). Runs both reviews in parallel. Use when reviewing PRs, branches, or work-in-progress changes.
license: MIT
compatibility: opencode
---

# Code Review

Two-axis review of changes between `HEAD` and a fixed point (commit, branch, tag, or merge-base).

## Process

### 1. Pin the Fixed Point

Capture the diff: `git diff <fixed-point>...HEAD` (three-dot). Also note commits via `git log <fixed-point>..HEAD --oneline`.

### 2. Identify Spec Source

Look for originating spec in this order:
1. Issue references in commit messages
2. Spec file under `docs/`, `specs/`, or matching branch name
3. Ask the user if nothing found

If no spec exists, the Spec axis reports "no spec available".

### 3. Identify Standards Sources

Load `.opencode/rules/coding.md` as primary standards reference. Also check:
- `.opencode/rules/testing.md` (quality gates)
- `.opencode/rules/security.md` (security review)
- `.opencode/rules/git.md` (commit conventions)

### 4. Standards Baseline (Always Applied)

Beyond repo standards, check for these code smells:
- **Mysterious Name** — name doesn't reveal purpose
- **Duplicated Code** — same logic appears in multiple places
- **Feature Envy** — method reaches into another object's data
- **Data Clumps** — same fields travelling together
- **Primitive Obsession** — domain concept as primitive
- **Shotgun Surgery** — one change forces scattered edits
- **Divergent Change** — one file edited for many reasons
- **Speculative Generality** — unused abstraction
- **Middle Man** — class that mostly delegates

### 5. Run Both Axes

**Standards axis:** Does code follow `.opencode/rules/coding.md` and baseline smells?

**Spec axis:** Does code faithfully implement the originating requirements?

### 6. Report

Present findings under two headings. Do NOT merge or rerank.

End with one-line summary: total findings per axis and worst issue in each.

## Why Two Axes

A change can pass one axis and fail the other:
- Code that follows every standard but implements wrong thing → Standards pass, Spec fail
- Code that implements requirements perfectly but breaks conventions → Spec pass, Standards fail

## Workspace Integration

**Related rules:** `.opencode/rules/coding.md`, `.opencode/rules/testing.md`, `.opencode/rules/security.md`, `.opencode/rules/git.md`
**Related workflow:** `.opencode/workflows/review.md`
**Related agents:** `@reviewer`
**Related skills:** `verify-completion`
