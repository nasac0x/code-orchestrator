---
name: writing-plans
description: Write detailed implementation plans from specs or requirements. Use when a design or spec is approved and ready for implementation. Breaks work into bite-sized tasks with exact file paths, code, and verification steps.
license: MIT
compatibility: opencode
---

# Writing Plans

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Scope Check

If the spec covers multiple independent subsystems, suggest breaking into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for.

- Design units with clear boundaries and well-defined interfaces
- Each file should have one clear responsibility
- Prefer smaller, focused files over large ones
- In existing codebases, follow established patterns
- Follow `.opencode/rules/architecture.md` principles

## Task Right-Sizing

A task is the smallest unit that carries its own test cycle. Fold setup, configuration, scaffolding into the task whose deliverable needs them. Each task ends with an independently testable deliverable.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test"
- "Run it to make sure it fails"
- "Implement minimal code to make test pass"
- "Run tests and make sure they pass"
- "Commit"

## Plan Document Structure

Every plan MUST contain:
- **Goal:** one sentence
- **Architecture:** 2-3 sentences
- **Global Constraints:** from spec
- **Tasks:** numbered, each with files, interfaces, steps, commands

## Task Format

```
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file`
- Modify: `exact/path/to/file:123-145`

**Interfaces:**
- Consumes: what this uses from earlier tasks
- Produces: what later tasks rely on

**Steps:**
- [ ] Step 1: [action with exact code]
- [ ] Step 2: [action with exact command]
- [ ] Step 3: [action with exact code]
```

## No Placeholders

Every step must contain actual content. These are plan failures:
- "TBD", "TODO", "implement later"
- "Add appropriate error handling" (without specifics)
- Steps without exact code and commands

## Self-Review

After writing the complete plan:
1. **Spec coverage** — can you point to a task for each requirement?
2. **Placeholder scan** — any TBD/TODO remaining?
3. **Type consistency** — do signatures match across tasks?

## Workspace Integration

**Related rules:** `.opencode/rules/architecture.md`, `.opencode/rules/coding.md`
**Related workflow:** `.opencode/workflows/feature.md`
**Related agents:** `@developer`, `@architect`
**Related skills:** `grill`, `brainstorm`, `tdd`
