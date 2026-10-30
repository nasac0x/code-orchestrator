# Skill Index - 122 skills

Every skill below lives in `skills/<name>/` in this repository. The orchestrator loads them
**on demand**, one at a time - that's what keeps small/free models on track.

Format: each skill is a folder with `SKILL.md` (some also carry `skill.json` with routing
metadata). Drop the folder into your agent's skills directory and it becomes available.

> To install: `cp -r skills/<name> ~/.config/opencode/skills/` (OpenCode) or your
> agent's equivalent skills path.

## Core orchestration

- **code-orchestrator** - the meta-skill itself (this repo's front door)
- **using-agent-skills** - skill discovery / invocation protocol
- **context-engineering** - context setup, rules files, quality degradation recovery
- **iterative-retrieval** - progressively refined codebase retrieval for subagents
- **autonomous-loops** - autonomous dev loops (pipelines → RFC-driven DAGs)

## Planning & requirements

- **requirements-review** - fuzzy intent → decisions, constraints, first step
- **feature-forge** - structured requirements workshop (EARS specs, user stories)
- **implementation-plan** - plan → ordered verifiable slices
- **writing-plans** - approved spec → detailed implementation plan
- **brainstorm** - idea → approved design (gate: no code before design)

## Architecture & design

- **architecture-review** · **architecture-designer** · **codebase-design**
- **api-and-interface-design** · **api-designer** · **graphql-architect**
- **microservices-architect** · **domain-modeling** · **convex-design**

## Stack skills (implementation)

Backend: **nestjs-expert** · **fastapi-expert** · **django-expert** · **laravel-specialist** ·
**rails-expert** · **spring-boot-engineer** · **java-architect** · **dotnet-core-expert** ·
**csharp-developer** · **golang-pro** · **rust-engineer** · **php-pro** · **salesforce-developer** ·
**kotlin-specialist** · **spark-engineer** · **rag-architect** · **fine-tuning-expert** ·
**mcp-developer** · **atlassian-mcp** · **websocket-engineer** · **django-storages-s3** ·
**convex-design** · **csharp-developer**

Frontend: **react-expert** · **react-native-expert** · **nextjs-developer** · **vue-expert** ·
**vue-expert-js** · **angular-architect** · **flutter-expert** · **swift-expert**

General / tools: **typescript-pro** · **javascript-pro** · **python-pro** · **cpp-pro** ·
**cli-developer** · **wordpress-pro** · **shopify-expert** · **playwright-expert** ·
**game-developer** · **embedded-systems** · **ml-pipeline** · **prompt-engineer** ·
**code-documenter** · **skill-creator** · **video-to-svg-animation** · **open-design** · **fidelity**

## Debugging

- **trace-bug** → **debugging-wizard** → **debug** → **debugging-and-error-recovery**

## Testing & verification

- **tdd** · **test-driven-development** · **test-and-verify** · **test-master** ·
- **verification-loop** · **verify-completion**

## Security

- **security-and-hardening** · **secure-code-guardian** · **security-reviewer**

## Performance

- **performance-optimization** · **database-optimizer** · **postgres-pro** · **sql-pro** ·
- **monitoring-expert**

## Legacy

- **legacy-modernizer** · **spec-miner**

## Documentation

- **documentation-and-adrs** · **code-documenter** · **oak-update-docs**

## Infra & cloud

- **terraform-engineer** · **kubernetes-specialist** · **devops-engineer** · **cloud-architect** ·
- **sre-engineer** · **chaos-engineer** · **database-optimizer** (infra side) · **fullstack-guardian**

## Delivery (commit / PR / ship)

- **oak-commit** · **smart_commit** · **code_review** · **oak-enrich-task** ·
- **oak-runtime-verification** · **handoff**

## Code review

- **code-review** · **code-review-and-quality** · **code-reviewer** · **oak-adversarial-review** ·
- **adversarial-review**

## Design (visual / UI / brand)

- **ui-ux-pro-max** · **design** · **ui-styling** · **design-system** · **banner-design** ·
 **slides** · **brand**

## Adversarial thinking

- **grill** · **grilling** · **grill-me** · **grill-with-docs** · **the-fool** ·
 **doubt-driven-development**

## Meta / language

- **pt-br** - Brazilian Portuguese output discipline

---

### Complete alphabetical list

<!--BEGIN_LIST-->
- adversarial-review · angular-architect · api-and-interface-design · api-designer ·
architecture-designer · architecture-review · atlassian-mcp · autonomous-loops ·
banner-design · brainstorm · brand · chaos-engineer · cli-developer · cloud-architect ·
code_review · codebase-design · code-documenter · code-orchestrator · code-review ·
code-review-and-quality · code-reviewer · code-simplification · context-engineering ·
convex-design · cpp-pro · csharp-developer · database-optimizer · debug ·
debugging-and-error-recovery · debugging-wizard · design · design-system · devops-engineer ·
django-expert · django-storages-s3 · documentation-and-adrs · domain-modeling ·
dotnet-core-expert · doubt-driven-development · embedded-systems · fastapi-expert ·
feature-forge · fidelity · fine-tuning-expert · flutter-expert · fullstack-guardian ·
game-developer · golang-pro · graphql-architect · grill · grilling · grill-me ·
grill-with-docs · handoff · implementation-plan · iterative-retrieval · java-architect · javascript-pro · kotlin-specialist ·
kubernetes-specialist · laravel-specialist · legacy-modernizer · mcp-developer ·
microservices-architect · ml-pipeline · monitoring-expert · nestjs-expert · nextjs-developer ·
oak-adversarial-review · oak-commit · oak-enrich-task · oak-runtime-verification ·
oak-update-docs · open-design · pandas-pro · performance-optimization · php-pro ·
playwright-expert · postgres-pro · prompt-engineer · pt-br · python-pro · rag-architect ·
rails-expert · react-expert · react-native-expert · requirements-review · rust-engineer ·
salesforce-developer · secure-code-guardian · security-and-hardening · security-reviewer ·
shopify-expert · skill-creator · slides · smart_commit · source-driven-development ·
spark-engineer · spec-miner · spring-boot-engineer · sql-pro · sre-engineer · swift-expert ·
tdd · terraform-engineer · test-and-verify · test-driven-development · test-master ·
the-fool · trace-bug · typescript-pro · ui-styling · ui-ux-pro-max · using-agent-skills ·
verification-loop · verify-completion · video-to-svg-animation · vue-expert · vue-expert-js ·
websocket-engineer · wordpress-pro · writing-plans
<!--END_LIST-->
