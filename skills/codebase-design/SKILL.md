---
name: codebase-design
description: Shared vocabulary for designing deep modules — small interface, lots of behavior behind it. Use when improving module interfaces, finding deepening opportunities, deciding where a seam goes, or making code more testable.
license: MIT
compatibility: opencode
---

# Codebase Design

Design **deep modules**: a lot of behavior behind a small interface, placed at a clean seam, testable through that interface.

Use this language and these principles wherever code is being designed or restructured. The aim is leverage for callers, locality for maintainers, and testability for everyone.

**NOTE:** This skill is about CODE architecture (module boundaries, interfaces). NOT for infrastructure or Docker architecture.

## Glossary

**Module** — anything with an interface and an implementation. Deliberately scale-agnostic: a function, class, package, or slice.

**Interface** — everything a caller must know to use the module correctly: type signature, invariants, ordering constraints, error modes, required configuration.

**Depth** — leverage at the interface: amount of behavior a caller (or test) can exercise per unit of interface they have to learn.

**Seam** (Michael Feathers) — a place where you can alter behavior without editing in that place. Where to put the seam is its own design decision.

**Adapter** — a concrete thing that satisfies an interface at a seam.

## Deep vs Shallow

**Deep module** = small interface + lots of implementation (GOOD):
- Few methods, simple params
- Complex logic hidden inside
- Callers only see the surface

**Shallow module** = large interface + little implementation (AVOID):
- Many methods, complex params
- Thin pass-through
- Surface nearly as complex as what's inside

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, swappable parts.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it.

## Designing for Testability

1. **Accept dependencies, don't create them** — inject, don't instantiate
2. **Return results, don't produce side effects** — pure functions are easiest to test
3. **Small surface area** — fewer methods = fewer tests needed

## When to Use This Skill

- Designing new modules or components
- Refactoring existing code with unclear boundaries
- Making code more testable
- Reducing coupling between modules
- During code review when design issues are found

## Workspace Integration

**Related rules:** `.opencode/rules/architecture.md`, `.opencode/rules/coding.md`
**Related agents:** `@architect`, `@developer`
**Related workflow:** `.opencode/workflows/refactor.md`
