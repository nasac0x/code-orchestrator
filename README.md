<div align="center">

# code-orchestrator

**One cheap AI model. A full dev team.**

*The skill-router meta-skill that turns a small, free or local LLM into a disciplined,
multi-discipline software engineering agent.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Made for OpenCode](https://img.shields.io/badge/Made%20for-OpenCode-6c5ce7)](https://opencode.ai)
[![Skills](https://img.shields.io/badge/skills-122-blue)](docs/SKILLS.md)
[![Free-model friendly](https://img.shields.io/badge/runs%20on-free%20%2F%20open%20LLMs-success)](docs/FREE-MODELS.md)
[![Reddit](https://img.shields.io/badge/share-on%20Reddit-FF4500)](https://reddit.com/r/LocalLLaMA)

</div>

---

## The problem

Small models are free. Big context is not.

Most AI coding agents stuff a **massive system prompt** - every tool, every convention, every
checklist - into the context window. That burns tokens, degrades reasoning and makes weak
plans with free-tier models like DeepSeek, GLM, Qwen and local Ollama models.

## The solution

`code-orchestrator` is a **meta-skill** that behaves like a project manager:

1. It reads your request and classifies the **intent** (plan? implement? debug? review? commit?)
2. It loads **only the specialized skill needed for that step** - a few KB of focused instructions
3. It chains skills through a pipeline (plan → implement → test → review → commit)
4. It enforces **hard gates** a small model would otherwise skip:
 - design approved before implementation
 - failing test before production code (TDD)
 - verification before "done"
 - adversarial review before merge
 - **circuit breaker** - never repeat the same failing tool call 2x (small models *will* loop)

```
        "debug this leak"
               |
               v
       +---------------------+
       |  code-orchestrator  |        (the routing table)
       +---------------------+
               |
               v
        intent: debugging
               |
               v
     trace-bug -> debugging-wizard -> debug
     (~2 skills loaded, not 122)
```

| Without orchestrator | With orchestrator |
|---|---|
| 1 mega-prompt, all tools for all tasks | Tiny core + **on-demand** skill loading |
| Small model drowns in instructions | Small model gets **one discipline at a time** |
| Forget to test · forget to verify · infinite retry loops | Gated pipeline + circuit breaker |
| Works "sometimes" | Same discipline regardless of model size |

**Result:** the same agent prompt that makes a frontier model shine keeps a free model useful.

## What's in this repo

```
code-orchestrator/
├── SKILL.md                 <- the orchestrator itself (start here)
├── skills/                  <- 122 skills: the full "database" this router pulls from
├── examples/rate-limiter/   <- real project built and shipped with the orchestrator
└── docs/                    <- deep dives (structure, index, free-models guide)
```

Every skill referenced by the routing table lives in [`skills/`](docs/SKILLS.md) - **download
the exact skill set this agent uses**, curate yours, or submit a new routing path.

## The showcase: built *with* the orchestrator, not just about it

[`examples/rate-limiter/`](examples/rate-limiter/README.md) is a production-grade **Token
Bucket rate limiter for Fastify (TypeScript)** - written end-to-end by a free model driven
through this orchestrator's pipeline (requirements → design → TDD → review → commit):

- Token Bucket algorithm with burst allowance, 429 + `Retry-After`, standard headers
- **Dual backend:** In-Memory (per-IP mutex) or **Redis (atomic Lua script, `EVALSHA`)** - zero race conditions across instances
- **Live monitoring dashboard** (`/dashboard` + `/api/metrics`): latency p50/p95/p99, top IPs, block rate
- **32 tests** with Vitest · strict TypeScript
- [Full demo docs →](examples/rate-limiter/README.md)

## Quick start (OpenCode)

```bash
# 1. Clone this repo
git clone https://github.com/nasac0x/code-orchestrator.git

# 2. Install the skills into your agent's skills directory
cp -r skills/* ~/.config/opencode/skills/

# 3. Invoke it in chat
# "use code-orchestrator: implement JWT auth for my NestJS backend"
```

Want to run on a **free/open/local model** (DeepSeek · GLM · Qwen · Ollama)?
Read [`docs/FREE-MODELS.md`](docs/FREE-MODELS.md) - the efficiency playbook written
specifically for small-context models.

### The author's current stack

Everything in this repo - including the showcase - was planned, coded, reviewed
and shipped **exclusively with free models**:

- **GLM 5.3 Flash** (Z.ai)
- **Nemotron Super** (NVIDIA)
- **Nemotron Ultra 550B** (NVIDIA)
- **Nemotron VL** (NVIDIA)
- **Step 5 Preview** (StepFun)

No paid frontier model was used in the pipeline. If you replicate it, report
your stack.

## Routing map (excerpt)

| Intent | Skill chain |
|---|---|
| plan a feature | `requirements-review` → `implementation-plan` → `writing-plans` |
| implement | `feature-forge` → `tdd` → `[stack skill]` |
| debug | `trace-bug` → `debugging-wizard` → `debug` |
| review / PR | `code-review-and-quality` → `oak-adversarial-review` |
| security | `secure-code-guardian` → `security-reviewer` |
| performance | `database-optimizer` → `postgres-pro` |
| commit / ship | `verify-completion` → `oak-commit` → `oak-update-docs` |

Full map: [`SKILL.md`](SKILL.md) · Full index: [`docs/SKILLS.md`](docs/SKILLS.md)

## Contributing

PRs welcome - especially:

- **new routing paths** (skill.json `routes`) for disciplines we missed
- **free-model reports** - which small model + which config finished a full pipeline?
- **new showcase skills** in `skills/`

## License

MIT - see [LICENSE](LICENSE).

---

<div align="center">

Built by **Victor (@nasac0x)** - [@victor.cs_ on Instagram](https://instagram.com/victor.cs_)

*If this saved you tokens, drop a star and tell us your cheapest model that shipped a feature.*

</div>

> Documentação em português disponível na comunidade BR - em breve: `docs/PT-BR.md`.
