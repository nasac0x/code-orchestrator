# Repository structure

```
code-orchestrator/
│
├── SKILL.md            # The orchestrator meta-skill - routing table + gates + circuit breaker
├── skill.json          # Machine-readable metadata (routes, triggers, permissions)
│
├── README.md           # This repo's front door (start here)
│
├── skills/             # The skill database: 123 folders
│   ├── code-orchestrator/   # (canonical copy of the orchestrator)
│   ├── tdd/                 # one folder = one skill = one SKILL.md (+ optional skill.json)
│   ├── trace-bug/
│   └── ... (118 more)
│
├── examples/
│   └── rate-limiter/        # Showcase: real project produced VIA the pipeline
│       ├── README.md        #   (docs of the demo itself)
│       ├── src/             #   Fastify + TypeScript, Redis Lua, metrics, dashboard
│       ├── tests/           #   32 tests with Vitest
│       └── ...
│
├── docs/
│   ├── SKILLS.md            # Full index of the 123 skills, by category
│   ├── FREE-MODELS.md       # Efficiency playbook for free/open/local models
│   ├── TOOLS.md             # External tools routing (agent-browser, excalidraw-mcp, ffmpeg-skill)
│   └── STRUCTURE.md         # (this file)
│
├── LICENSE             # MIT
└── .gitignore
```

## Conventions

- **One skill = one folder** with `SKILL.md` (plain Markdown instructions some agents
auto-discover) and, optionally, `skill.json` (metadata + routing declarations).
- **`skill.json.routes`** maps intent categories → skill names. Adding a route = editing
the orchestrator's `skill.json` + dropping the skill in `skills/`.
- **The example is not a library.** `examples/rate-limiter` exists to demonstrate the
 *process* (pipeline) and the *artifact* (quality), not to be `npm install`ed.
- **Skills are language-agnostic**: most are pure Markdown, independent of the host
agent (OpenCode today; port trivial to other skills-dir implementations).
