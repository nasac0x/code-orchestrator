---
name: code-orchestrator
description: Orquestrador mestre de desenvolvimento de software. Ativa APENAS quando solicitado explicitamente ("use code-orchestrator") ou quando detecta tarefa de programação/debug/arquitetura. Não auto-ativa em conversas gerais. Roteia para skills especializadas: code-review, debugging, arquitetura, testes, segurança, refatoração, planejamento, documentação.
---

# Code Orchestrator - Skill Mestre de Desenvolvimento

## Princípio Fundamental
**Esta skill NÃO auto-ativa.** Ela só entra em ação quando:
1. Você invoca explicitamente: "use code-orchestrator" ou "code-orchestrator: ..."
2. Detecta pedido claro de: escrever código, debuggar, revisar código, arquitetar, testar, refatorar, documentar código

Em conversas gerais, acadêmicas, de análise de dados, design UI/UX, etc. - **permanece inativa**.

---

## Mapa de Roteamento (Intenção → Skill Especializada)

| Intenção detectada | Skill(s) invocada(s) | Gatilhos típicos |
|---|---|---|
| **Planejar feature / quebrar em tarefas** | `requirements-review` → `implementation-plan` → `writing-plans` | "planeje", "breack down", "tasks", "implementation plan", "PRD" |
| **Arquitetar / decisões estruturais** | `architecture-review` → `architecture-designer` → `codebase-design` → `api-and-interface-design` | "arquitetura", "ADR", "system design", "microservices", "boundaries", "coupling" |
| **Modelar domínio / linguagem ubíqua** | `domain-modeling` | "domínio", "entidades", "glossário", "naming", "ubiquitous language" |
| **Escrever código (feature nova)** | `feature-forge` → `tdd`/`test-driven-development` → `source-driven-development` → skill de stack específica (ex: `nextjs-developer`, `nestjs-expert`, `python-pro`, etc.) | "implemente", "crie", "build", "feature", "endpoint", "component" |
| **Debuggar / diagnosticar bug** | `trace-bug` → `debugging-wizard` → `debug` → `debugging-and-error-recovery` | "debug", "bug", "erro", "falha", "não funciona", "stack trace", "performance regression" |
| **Revisar código / PR** | `code-review-and-quality` → `code-reviewer` → `code_review` → `oak-adversarial-review` → `security-and-hardening`/`security-reviewer` | "review", "code review", "PR", "pull request", "revise", "auditoria" |
| **Refatorar / simplificar** | `code-simplification` → `codebase-design` → `refactor-agent` (se existir) | "refatore", "simplifique", "clean up", "technical debt", "legacy" |
| **Testes / verificação** | `test-driven-development` → `test-and-verify` → `test-master` → `verification-loop` → `verify-completion` | "teste", "TDD", "cobertura", "unit test", "integration test", "E2E" |
| **Segurança / hardening** | `security-and-hardening` → `secure-code-guardian` → `security-reviewer` | "segurança", "OWASP", "vulnerabilidade", "auth", "sanitização" |
| **Performance / otimização** | `performance-optimization` → `database-optimizer` → `monitoring-expert` | "performance", "lento", "otimize", "bottleneck", "query lenta" |
| **Legado / modernização** | `legacy-modernizer` → `spec-miner` → `architecture-review` | "legado", "migração", "strangler fig", "modernize", "monolito" |
| **Documentar / ADRs** | `documentation-and-adrs` → `code-documenter` → `oak-update-docs` | "documente", "ADR", "documentação", "README", "API docs" |
| **Commit / PR / entrega** | `oak-commit` → `smart_commit` → `verification-loop` → `oak-runtime-verification` | "commit", "PR", "entregar", "push", "merge" |
| **Handoff / troca de contexto** | `handoff` | "handoff", "trocar contexto", "pausar", "continuar depois" |
| **Stack específica** | Skill correspondente (ex: `react-expert`, `nestjs-expert`, `golang-pro`, `rust-engineer`, etc.) | Menção explícita da tech stack |
| **Design Gráfico / Visual** | `ui-ux-pro-max` → `design` → `ui-styling` → `design-system` → `banner-design` → `slides` → `brand` | "design gráfico", "visual design", "branding", "banner", "landing page", "dashboard visual", "design system", "apresentação", "slides", "UI kit", "style guide" |
| **Mídia / Vídeo** | `ffmpeg-skill` (copiada no hub) + MCP do ffmpeg-skill quando disponível | "vídeo", "áudio", "mp4", "ffmpeg", "legenda", "transcrição", "Reels", "TikTok", "normalize", "mp3", "wav" |
| **Browser automático** | Ferramentas externas: `agent-browser` (CLI, carrega skills própria conforme a versão) + skill `playwright-expert` do hub | "abrir página", "scraping", "teste E2E de UI", "screenshot", "selenium/playwright/agent-browser" |
| **Diagramas / desenhos** | MCP externo: `excalidraw-mcp` | "desenha", "diagrama", "arquitetura visual", "excalidraw" |

---

## Fluxo de Execução (quando ativado)

```
1. ANALISAR pedido → classificar intenção(ões)
2. CARREGAR skill(s) especializada(s) via `skill <id>`
3. EXECUTAR fluxo da skill especializada
4. SE necessário, encadear próxima skill (ex: plan → implement → test → review → commit)
5. REVISÃO ADVERSARIAL → carregar `adversarial-review` e executar Fase 0-8 (isolado, tenta refutar)
6. SE BLOQUEADO → voltar à implementação com achados; reexecutar revisão (máx. 2 rodadas)
7. REPORTAR resultado + próximos passos recomendados
```

---

## Como Invocar

```bash
# Explícito (recomendado)
"use code-orchestrator: implemente autenticação JWT no backend NestJS"
"code-orchestrator: debuggue este memory leak no Node.js"
"code-orchestrator: revise este PR para segurança e performance"
"code-orchestrator: arquitetue microserviços para e-commerce"

# Ou apenas peça para codar - o orchestrator detecta
"implemente login com OAuth2"
"corrija este bug no checkout"
"refatore o service de pagamentos"
```

---

## Skills Disponíveis no Ecossistema (já instaladas globalmente)

### Core Orchestration
- `using-agent-skills` - meta-skill de descoberta/invocação
- `context-engineering` - otimiza contexto do agente
- `iterative-retrieval` - recuperação progressiva de contexto
- `autonomous-loops` - pipelines autônomos multi-agente

### Planejamento & Requisitos
- `requirements-review` - fuzzy intent → decisões + constraints + 1º passo
- `feature-forge` - workshop estruturado → specs EARS + user stories + checklists
- `implementation-plan` - intenção → fatias verificáveis + acceptance criteria
- `writing-plans` - spec aprovada → plano detalhado (arquivos, código, verificação)
- `brainstorm` - refina ideias em designs ANTES de implementar (gate obrigatório)

### Arquitetura & Design
- `architecture-review` - riscos estruturais, boundary leaks, shallow modules, refatorações reversíveis
- `architecture-designer` - system design, ADRs, trade-offs, diagramas, escalabilidade
- `codebase-design` - deep modules, interfaces pequenas, seams, testabilidade
- `api-and-interface-design` - APIs estáveis, contratos de tipo, boundaries FE/BE
- `api-designer` - REST/GraphQL, OpenAPI, versioning, pagination, error handling
- `microservices-architect` - DDD, bounded contexts, saga, event sourcing, CQRS, service mesh
- `domain-modeling` - glossário, entidades, estados, aliases, naming rules

### Implementação (Stack-Agnostic + Stack-Specific)
- `tdd` / `test-driven-development` - RED-GREEN-REFACTOR enforcado
- `source-driven-development` - decisões baseadas em docs oficiais
- `code-simplification` - clareza sem mudar comportamento
- **67+ skills de stack** (farmage): `nextjs-developer`, `nestjs-expert`, `python-pro`, `rust-engineer`, `golang-pro`, `react-expert`, `vue-expert`, `typescript-pro`, `java-architect`, `csharp-developer`, `fastapi-expert`, `django-expert`, `laravel-specialist`, `rails-expert`, `spring-boot-engineer`, `flutter-expert`, `react-native-expert`, `swift-expert`, `kotlin-specialist`, `angular-architect`, `graphql-architect`, `websocket-engineer`, `cli-developer`, `embedded-systems`, `game-developer`, `ml-pipeline`, `rag-architect`, `fine-tuning-expert`, `pandas-pro`, `sql-pro`, `postgres-pro`, `database-optimizer`, `terraform-engineer`, `kubernetes-specialist`, `devops-engineer`, `cloud-architect`, `sre-engineer`, `chaos-engineer`, `monitoring-expert`, `playwright-expert`, `spec-miner`, `legacy-modernizer`, `mcp-developer`, `atlassian-mcp`, `prompt-engineer`, `code-documenter`, `shopify-expert`, `wordpress-pro`, `salesforce-developer`, `spark-engineer`, `cpp-pro`, `php-pro`, `javascript-pro`

### Debugging & Qualidade
- `trace-bug` - loop disciplinado: feedback → reproduz → hipótese → instrumenta → fixa → regressão → cleanup
- `debugging-wizard` - stack traces, logs, hipótese-driven methodology
- `debug` - reproduz, minimiza, hipotetiza, instrumenta, fixa, regression-test
- `debugging-and-error-recovery` - root-cause sistemático
- `code-review-and-quality` - review multi-eixo (security, testing, performance, arquitetura), profiles por stack
- `code-reviewer` - bugs, SQLi, XSS, N+1, code smells, arquitetura → relatório estruturado
- `code_review` - diff vs main, DDD/SOLID/security/tests/performance, Mermaid diagrams
- `oak-adversarial-review` - assume change is wrong, attack along fixed dimensions, explicit verdict

### Testes & Verificação
- `test-and-verify` - baseline → failing proof → minimal edit → final proof
- `test-master` - unit/integration/E2E, mocking, coverage, test plans, performance/security testing
- `verification-loop` - multi-phase verification após feature/PR/refactor
- `verify-completion` - evidence before assertions, run verification commands before claiming done

### Segurança
- `security-and-hardening` - user input, auth, data storage, external integrations
- `secure-code-guardian` - OWASP Top 10, bcrypt/argon2, parameterized queries, CORS/CSP, Zod, JWT
- `security-reviewer` - SAST, pentest, DevSecOps, cloud security, dependency audit, secrets scanning

### Performance
- `performance-optimization` - Core Web Vitals, load times, profiling bottlenecks
- `database-optimizer` - slow queries, EXPLAIN, indexes, partitioning, lock contention
- `postgres-pro` / `sql-pro` - advanced DB features, query optimization

### Design Gráfico / Visual
- `ui-ux-pro-max` - UI/UX design intelligence (79 estilos, 192 paletas, 22 stacks, design system generation)
- `design` - skill abrangente: logo, CIP, design system, apresentações, ícones, fotos sociais
- `ui-styling` - shadcn/ui, Tailwind, Radix UI, componentes acessíveis, theming, dark mode
- `design-system` - token architecture, component specs, CSS variables, spacing/typography scales
- `banner-design` - banners para redes sociais, anúncios, heroes, assets criativos (22 estilos)
- `slides` - apresentações HTML estratégicas com Chart.js, design tokens, layouts responsivos
- `brand` - brand voice, identidade visual, messaging frameworks, asset management, brand compliance

### Documentação & Entrega
- `documentation-and-adrs` - ADRs, API changes, feature shipping, context recording
- `code-documenter` - docstrings, OpenAPI, JSDoc, doc portals, tutorials
- `oak-update-docs` - last step: update source-of-truth docs before commit
- `oak-commit` - atomic commits, messages from actual diff, PR body
- `smart_commit` - changes, branches, rebase, commits auto best practices
- `oak-runtime-verification` - prove change works in running system (screen, command, endpoint, job, datastore)
- `oak-enrich-task` - short request → implementable spec (scope, reuse, requirements, acceptance, hostile tests, open questions)
- `handoff` - durable engineering handoff (changed files, goal, evidence, risks, blocked, restart prompt)

### Adversarial / Critical Thinking
- `grill` - stress-testa planos/decisões/ideias
- `doubt-driven-development` - fresh-context adversarial review antes de decisions立
- `the-fool` - devil's advocate, pre-mortem, red team, audit evidence/assumptions
- `adversarial-review` - revisão profunda isolada: tenta REFUTAR o software (Fase 0-8), hipóteses numeradas, sondas executáveis, relatório COMPROVADO/HIPÓTESE/REFUTADO, veredito APROVADO/BLOQUEADO, máx. 2 rodadas

---

## Exemplo de Uso Interno (como eu, o modelo, opero)

```text
User: "code-orchestrator: crie API de pagamentos com Stripe no NestJS"

Orchestrator (eu):
1. Classifico: implementação + stack específica (NestJS) + segurança (pagamentos)
2. Invoco sequência:
 - requirements-review (clarear escopo: webhooks, idempotência, refunds, testes)
 - implementation-plan (fatias: module, service, controller, DTOs, guards, tests)
 - nestjs-expert (implementação real com DI, guards, interceptors, TypeORM/Prisma)
 - secure-code-guardian (validar input, idempotency keys, webhook signature verification)
 - test-driven-development / test-master (unit + integration + E2E webhooks)
 - code-review-and-quality (review multi-eixo antes de commit)
 - oak-commit / verification-loop (entrega)
3. Reporto progresso a cada etapa, peço confirmação nos gates
```

---

## Gates Obrigatórios (não puláveis)

| Gate | Skill que enforça | Quando |
|---|---|---|
| Design aprovado antes de implementar | `brainstorm` | Início de feature nova |
| Requisitos claros + constraints | `requirements-review` | Antes de `implementation-plan` |
| Test falhando antes de código | `tdd` / `test-driven-development` | Implementação |
| Verificação antes de "pronto" | `verify-completion` / `verification-loop` | Antes de commit/PR |
| Review adversarial antes de merge | `oak-adversarial-review` / `code-review-and-quality` | PR/merge |
| **Design review (visual/brand/UX)** | `ui-ux-pro-max` / `design` / `ui-styling` | Antes de entregar UI/produção |
| **Revisão adversarial profunda (tentar refutar)** | **`adversarial-review`** | **Após testes + implementação, antes de entrega** |
| Docs atualizadas | `oak-update-docs` | Último step antes de commit |
| Handoff se pausa longa | `handoff` | Antes de compactar/trocar contexto |

---

## Notas de Implementação

- Skills são carregadas **sob demanda** via tool `skill <id>` - não pré-carregadas.
- O orchestrator **não substitui** as skills especializadas; ele **orquestra** a invocação correta.
- Para stacks: o orchestrator detecta menção (ex: "NestJS", "React", "Go") e invoca a skill correspondente do pack farmage.
- Se nenhuma skill de stack matchar, usa `source-driven-development` + `codebase-design` + `tdd` como fallback genérico.
- Todas as skills já estão em `~/.config/opencode/skills/` (global).

## Circuit Breaker (Proteção contra Loops de Erro)

**REGRA OBRIGATÓRIA:** Se a mesma chamada de ferramenta falhar **2 vezes consecutivas com o mesmo erro**, **NÃO REPITA**.

Em vez disso:
1. **Releia o erro** com atenção - qual argumento exato o erro cita?
2. **Corrija o argumento citado** no erro (não chute; o erro diz o que está errado)
3. **OU troque de estratégia** (ex: import diferente, API alternativa, abordagem distinta)
4. Só então tente novamente

**Exemplo prático:**
```
Tentativa 1: write() → erro "path: Missing key"
Tentativa 2: write() → erro "path: Missing key" ← MESMO ERRO = PARA
Ação: Releio erro → vejo que falta `path` no JSON → corrijo → tenta 3ª vez
```

**Por que existe:** Modelos menores não aplicam essa regra sozinhos; eles repetem o mesmo erro infinitamente. Esta regra força a pausa, leitura e correção deliberada.

**Aplicação:** Vale para TODAS as tools (`write`, `edit`, `shell`, `skill`, `websearch`, etc.). Se falhou 2x com mesmo erro → PARE, LEIA, CORRIJA, MUDE ESTRATÉGIA.