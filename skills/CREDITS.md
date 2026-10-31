# Credits and attribution

The skills in this repository are **not ours**. `skills/` is a curated snapshot
of public skill files that the code-orchestrator routes to, copied to make the
whole setup reproducible in one clone. The orchestrator itself coordinates
them; the skills below belong to their original authors and packs.

If any work here is yours and you want a different credit, link change, or
removal, open an issue or a PR and we will fix it quickly.

## Sources

### Jeffallan/claude-skills (MIT)

~60 skills: angular-architect, api-designer, architecture-designer,
atlassian-mcp, chaos-engineer, cli-developer, cloud-architect,
code-documenter, code-reviewer, cpp-pro, csharp-developer,
database-optimizer, debugging-wizard, devops-engineer, django-expert,
dotnet-core-expert, embedded-systems, fastapi-expert, feature-forge,
fine-tuning-expert, flutter-expert, fullstack-guardian, game-developer,
golang-pro, graphql-architect, java-architect, javascript-pro,
kotlin-specialist, kubernetes-specialist, laravel-specialist,
legacy-modernizer, mcp-developer, microservices-architect, ml-pipeline,
monitoring-expert, nestjs-expert, nextjs-developer, pandas-pro, php-pro,
playwright-expert, postgres-pro, prompt-engineer, python-pro, rag-architect,
rails-expert, react-expert, react-native-expert, rust-engineer,
salesforce-developer, secure-code-guardian, security-reviewer, shopify-expert,
spark-engineer, spec-miner, spring-boot-engineer, sql-pro, sre-engineer,
swift-expert, terraform-engineer, test-master, the-fool, typescript-pro,
vue-expert, vue-expert-js, websocket-engineer, wordpress-pro.

Source: https://github.com/Jeffallan/claude-skills (MIT License, by Jeffallan)

### nextlevelbuilder/ui-ux-pro-max-skill (MIT)

- **ui-ux-pro-max**: the full design-intelligence skill (searchable styles,
  palettes, font pairings, UX guidelines, stack references and Python search
  tooling).
- banner-design, brand, design, design-system, slides and ui-styling:
  shipped inside the same repository, with front-matter declaring
  `author: claudekit` (ClaudeKit, https://docs.claudekit.cc).
  Credited here to the same repository + ClaudeKit.

Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT License,
by Next Level Builder). Original copyright statements and any LICENSE.txt
files shipped inside skill folders are preserved.

### addyosmani/agent-skills

- context-engineering
- doubt-driven-development
- using-agent-skills

Source: https://github.com/addyosmani/agent-skills (by Addy Osmani)

### affaan-m/ecc

- autonomous-loops
- iterative-retrieval
- verification-loop

Source: https://github.com/affaan-m/ecc (as declared in the front-matter of
each skill at collection time)

### awais786

- django-storages-s3

Source: https://github.com/awais786 (MIT, as declared in front-matter)

### obra/superpowers (Jesse Vincent, MIT)

Parts of two skills embed rows adapted from obra/superpowers and keep the
original attribution inline (code-reviewer: spec compliance and receiving
feedback; debugging-wizard: systematic debugging).

Source: https://github.com/obra/superpowers (MIT, by Jesse Vincent)

### anthropics/claude-plugins-official

- code-simplification is explicitly stated in its file to be "Inspired by the
  Claude Code Simplifier plugin", adapted as a model-agnostic skill.

Source of the original idea: https://github.com/anthropics/claude-plugins-official

### kajisho5/ffmpeg-skill (MIT)

- ffmpeg-skill: local video/audio editor for coding agents bundled at
  `skills/ffmpeg-skill/` (42 tools with probe -> edit -> check -> look
  verification workflow, machine-readable contract and optional MCP server).

Source: https://github.com/kajisho5/ffmpeg-skill (MIT License, by kajisho5)

### This repository (Victor / @nasac0x)

- code-orchestrator (the meta-skill itself, with NVIDIA Nemotron generation
  assistance)
- adversarial-review

License: MIT, see LICENSE at the repository root.

### Others (provenance not documented)

The remaining skills arrived in the local environment without declared origin
in front-matter or skill.json. Listed for transparency: api-and-interface-design, architecture-review, brainstorm, code-review, code_review,
codebase-design, convex-design, debug, debugging-and-error-recovery,
documentation-and-adrs, domain-modeling, fidelity, grill, grill-me,
grill-with-docs, grilling, handoff, implementation-plan, oak-adversarial-review, oak-commit, oak-enrich-task,
oak-runtime-verification, oak-update-docs, open-design, performance-optimization, pt-br, requirements-review, skill-creator,
smart_commit, source-driven-development, tdd, test-and-verify, test-driven-development, trace-bug, verify-completion,
video-to-svg-animation, writing-plans.

Notes:
- convex-design and ui-styling ship their own license terms inside their
  folders (LICENSE.txt), which we preserve and point to.
- video-to-svg-animation was authored in this environment (Victor), but we
  keep it in this "not documented upstream" section until a dedicated entry
  is confirmed.

## How to update this file

1. Find the original source of the skill (git remote, pack README or the
   front-matter claims of SKILL.md).
2. Add the skill to the right section above (or create a new section).
3. Reference the skill folder name exactly as it lives in `skills/`.

Kept in sync with docs/SKILLS.md, which indexes what each skill does.
