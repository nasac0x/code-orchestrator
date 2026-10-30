---
name: grill
description: Grill the user relentlessly about a plan, decision, or idea. Use when requirements are unclear, the user is unsure about approach, or to stress-test thinking before starting implementation.
license: MIT
compatibility: opencode
---

# Grilling: Stress-Test Ideas Before Building

Interview me relentlessly about every aspect of this until we reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one.

## Process

1. **Explore context** — check project files, recent changes, existing architecture
2. **One question at a time** — understand purpose, constraints, success criteria
3. **Provide your recommended answer** for each question
4. **Look up facts** from environment (files, tools) rather than asking
5. **Decisions are mine** — put each to me and wait for my answer

Ask questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

Do not act on the plan until I confirm we have reached a shared understanding.

## When to Use

- Requirements are vague or incomplete
- User says "I want to build X" without details
- User mentions any "grill" trigger phrases
- Starting a new feature or significant change
- Before loading `brainstorm` or `writing-plans` skills
- When the task scope is unclear

## When Not to Use

- Simple bug fixes with clear reproduction steps
- Trivial changes (typo fix, rename, formatting)
- When user has already provided detailed specs

## Output

After grilling session, you should have:
- Clear understanding of WHAT needs to be built
- Clear understanding of WHY it needs to be built
- Clear success criteria
- List of open decisions resolved
- Ready for brainstorming or implementation planning

## Workspace Integration

**Related workflow:** `.opencode/workflows/feature.md` (Stage 1: Requirements)
**Related agents:** `@architect`, `@developer`
**Related skills:** `brainstorm`, `writing-plans`
**Related rules:** `.opencode/rules/communication.md`
