---
name: brainstorm
description: Refine ideas into designs before implementation. Use when starting creative work — new features, components, or functionality. Load BEFORE any implementation code is written. Mandatory gate: no implementation without approved design.
license: MIT
compatibility: opencode
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

## HARD GATE

Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY task regardless of perceived simplicity.

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences), but you MUST present it and get approval.

## Process Checklist

1. **Explore project context** — check files, docs, recent commits
2. **Ask clarifying questions** — one at a time, understand purpose/constraints/success criteria
3. **Propose 2-3 approaches** — with trade-offs and your recommendation
4. **Present design** — in sections scaled to their complexity, get user approval after each section
5. **Save design** — commit to repo

## Design Principles

- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **Separation of concerns** — each component has one clear purpose
- **Well-defined interfaces** — components communicate through clear contracts
- **Follow existing patterns** — respect existing codebase conventions
- **Isolation** — break into smaller units that can be understood independently

## Output

After brainstorming session, produce:
- Validated design with user approval
- Architecture description (components, data flow, interfaces)
- Ready for `writing-plans` skill

## Workspace Integration

**Related rules:** `.opencode/rules/architecture.md`, `.opencode/rules/documentation.md`
**Related workflow:** `.opencode/workflows/feature.md` (Stage 1: Architecture)
**Related agents:** `@architect`, `@developer`
**Related skills:** `grill` (pre-brainstorm refinement), `writing-plans` (post-brainstorm planning)
