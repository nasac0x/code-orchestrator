---
name: verify-completion
description: Verification before claiming completion. Use BEFORE committing, creating PRs, or claiming any task is done. Requires running verification commands and confirming output before making any success claims. Evidence before assertions always.
license: MIT
compatibility: opencode
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim
```

Skip any step = lying, not verifying

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Workspace Quality Gates (from `.opencode/rules/testing.md`)

Before claiming completion, verify ALL applicable gates:

- **Gate 1: Build** — compiles without errors, no new warnings
- **Gate 2: Tests** — all tests pass, adequate coverage
- **Gate 3: Code Quality** — follows `.opencode/rules/coding.md`, no artifacts
- **Gate 4: Security** — input validation, no exposed secrets
- **Gate 5: Documentation** — public APIs documented, complex logic explained

## Red Flags — STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!")
- About to commit/push/PR without verification
- Trusting agent success reports without running commands
- Relying on partial verification
- Thinking "just this once"
- **ANY wording implying success without having run verification**

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Bug fix:**
```
✅ Run reproducing test → see it pass → confirm original symptom gone
❌ "I fixed it" without verification
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- Committing, PR creation, task completion
- Moving to next task
- Delegating to `@reviewer` or other agents

## Related Documents

- `.opencode/rules/testing.md` — quality gates
- `.opencode/workflows/review.md` — review workflow
- `.opencode/agents/reviewer.md` — reviewer agent
- `.opencode/agents/developer.md` — developer agent
