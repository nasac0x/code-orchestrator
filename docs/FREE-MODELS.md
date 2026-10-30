# 🆓 Efficiency playbook: using code-orchestrator with free & open-source models

This repo is designed for models where **every token matters**: DeepSeek, GLM, Qwen,
Llama, Mistral — served free-tier or locally via Ollama/LM Studio. The orchestrator is
the **compensation layer** that makes small models behave like a disciplined dev team.

## 1. Why orchestrating beats stuffing context

Small models degrade fast with long context: instruction-following drops, tools get
called with wrong arguments, and retry-loops burn your rate limit. The orchestrator
fights back structurally:

| Behavior of a small model | Orchestrator's countermeasure |
|---|---|
| Mixes test conventions with deployment steps in one shot | **Installments**: one skill at a time — the model sees ONE discipline per turn |
| Repeats the same failing tool call forever | **Circuit breaker**: 2 identical failures → STOP, read the error, fix the cited argument |
| Jumps to code without a design | **Gate**: `brainstorm`/`requirements-review` must run first (design approval is not skippable) |
| Claims "done" without running anything | **Gate**: `verify-completion` — evidence before assertions |
| Sits a huge diff in the log without commit | **Delivery chain**: `oak-commit` (atomic commits) at the end |

## 2. Rules of engagement for free models

1. **Say the intent explicitly.** "use code-orchestrator: debugge este memory leak" —
   explicit invocation skips intent-classification errors in small models.

2. **One verb per request.** Ask for implementation *OR* review *OR* docs — the router
   chains them, but a small model that receives all three at once drops steps.

3. **Do not mark the as-referenced skills of skill-cache.** Let the router load them:
   soft skills stay out of context until a step requires them.

4. **Keep the routing table, cut the fat.** The orchestrator's core prompt IS the
   routing table (a few hundred tokens). Everything else is on-demand. That's the
   design that survives a 32k context window.

5. **Batch independent calls.** The router instructs the agent to parallelize
   independent tool calls — fewer round trips, fewer inference calls on your free tier.

## 3.GUI Recommended configs

| Budget | Model | Serve via | Notes |
|---|---|---|---|
| Free tier API | DeepSeek V3 / GLM / Qwen-Coder | provider APIs | Best step-followers per token among the free options |
| Local 8B | Qwen2.5-Coder-7B, Llama 3.1 8B | Ollama / LM Studio | Always invoke the orchestrator explicitly; keep requests small |
| Local 70B (~) | Qwen2.5-72B, Llama 3.3 70B | — | Handles multi-step chains natively; still skips no gates |

## 4. The demo as evidence

`examples/rate-limiter/` was driven through the full pipeline
(plan → TDD → implementation → review → commit) producing:

- 32 passing tests (Vitest), strict TypeScript
- Dual-backend architecture (in-memory mutex / Redis Lua-atomic)
- Complete docs, conventional commits, zero races

Cheapest model that ships this wins — report yours in a PR 🏆

## 5. Measuring your savings

Rough accounting for a "debug a bug" task:

- **Monolithic approach**: ~15k prompt tokens *every* turn (system prompt respawned)
- **Orchestrated**: ~1.5–3k base + ~2–5k for the one active skill

Even on free tiers, that's the difference between a response the model can still
reason about and one it gave up on halfway.
