---
name: adversarial-review
description: Revisão adversarial profunda e isolada. Tenta REFUTAR o software (não confirmar). Executa Fase 0–8: isola, inventaria fronteiras, roda como produção, lê com perguntas de falha, compara promessa vs realidade, sonda hipóteses com scripts mínimos, classifica achados (COMPROVADO/HIPÓTESE/REFUTADO), emite relatório APROVADO/BLOQUEADO. Gatilho: toda tarefa que gere código executável. Contexto ISOLADO — sem acesso ao raciocínio do implementador. Máx. 2 rodadas.
---

# Adversarial Review — Revisão que Tenta Refutar

## Princípio Fundamental
**O revisor tenta REFUTAR o software, não confirmá-lo.** Cada afirmação "isso funciona" precisa de evidência de execução; cada suspeita precisa de uma sonda que a confirme ou refute. Refutar uma suspeita também é resultado válido e deve ser registrado.

**Contexto ISOLADO:** O revisor recebe SOMENTE código, testes, docs/README e config. Nunca o raciocínio nem as justificativas de quem implementou. O agente que implementou **não pode ser o revisor**.

**Gatilho:** Toda tarefa que gere código executável.

**Saída:** Relatório de achados + testes que falham + veredito **APROVADO** / **BLOQUEADO**.

**Roteamento:** BLOQUEADO volta à implementação recebendo SÓ os achados e os testes vermelhos; depois reexecuta a revisão (inclusive checando se a correção quebrou algo que antes funcionava). **Máximo 2 rodadas**. Se restar achado CRÍTICO/ALTO, informe o usuário; **nunca declare "concluído"**.

---

## O MÉTODO DO REVISOR (Fases 0–8)

### Fase 0 — Isolar
Copie o projeto para um diretório novo e trabalhe nele. Não altere o original. Scripts de sonda ficam **FORA** da pasta do projeto e são apagados depois.

```bash
# Exemplo
cp -r /path/to/project /tmp/adversarial-review-<timestamp>
cd /tmp/adversarial-review-<timestamp>
```

### Fase 1 — Inventariar e Mapear Fronteiras
Liste os arquivos e identifique:
- Pontos de entrada (CLI, HTTP, handlers, jobs)
- Scripts de build/start (`package.json`, `Makefile`, `pyproject.toml`)
- Dependências (produção vs dev)
- O que é gerado (`dist/`, `build/`, `.next/`)
- O que está versionado sem necessidade (`.env`, `dist/`, segredos)

**Monte o MAPA DE FRONTEIRAS:**

| Categoria | Itens a mapear |
|---|---|
| **a) Entradas do atacante** | Headers, query, body, path, IP, arquivos, cookies, env vars |
| **b) Dependências externas** | Banco, cache, fila, API, disco, rede, DNS |
| **c) Tempo** | Relógio, TTLs, timeouts, janelas, intervalos, cron |
| **d) Configuração** | Variáveis de ambiente, defaults, valores hardcoded, feature flags |
| **e) Ciclo de vida** | Boot, shutdown, reconexão, restart, hot-reload, migrations |

**Tudo que você investigar nas fases seguintes nasce deste mapa.**

### Fase 2 — Executar Como em Produção
Antes de ler o código a fundo, rode o caminho real que um usuário rodaria, seguindo o README e os scripts do `package.json`/`pyproject.toml`:

1. **Instalação limpa** (`npm ci`, `pip install -r requirements.txt`)
2. **Typecheck/lint** (`npm run build`, `tsc --noEmit`, `ruff check`, `mypy`)
3. **Build de produção** (artefato real, não dev)
4. **Iniciar como em produção** (`NODE_ENV=production node dist/app.js`, `gunicorn`, `uvicorn --workers 4`) — **NÃO modo dev**
5. **Chamar de verdade** com `curl`/cliente HTTP real contra a porta exposta

**Registre também:** quantos testes rodaram e quantos foram **PULADOS (skipped)** e por quê.

**Falha em qualquer passo = achado CRÍTICO**; não prossiga fingindo que não é.

**Verifique que arquivos de runtime que não são código** (`.lua`, `.sql`, `.json`, templates, assets) **chegam ao artefato de build**.

### Fase 3 — Ler com Perguntas de Falha (Gerar Hipóteses)
Leia fonte, testes, config e README **por inteiro**. Para **CADA item do mapa de fronteiras** aplique o banco de perguntas abaixo. Cada suspeita vira uma **HIPÓTESE numerada**, no formato:

```
H<n>: "<o que eu acho que falha>" 
    | previsão: "<o que eu espero observar se eu estiver certo>" 
    | como provar: "<sonda mínima>"
```

**Escreva a previsão ANTES de rodar qualquer coisa** (evita viés de confirmação).

**Técnica de constantes:** Procure **todo número e string literal** no código (TTLs, limites, timeouts, tamanhos, defaults). Para cada um pergunte: *"Isto deveria ser derivado de alguma configuração?"* Se é fixo mas a config pode mudar, teste a config em valores **EXTREMOS** (muito maior e muito menor que o padrão).

---

### Banco de Perguntas (Aplicar a cada item do Mapa de Fronteiras)

| Fronteira | Perguntas |
|---|---|
| **Dependência externa** | E se estiver fora no boot? Cair no meio do uso? Voltar depois? Ficar lenta (há timeout)? Perder estado (restart/failover: scripts, caches, sessões pré-carregadas somem)? A política de falha (continuar liberando ou bloquear) é uma **DECISÃO explícita e configurável**, ou acidente? |
| **Assincronismo/ciclo de vida** | Há promise criada no construtor/boot? Se rejeitar uma vez, recupera ou fica quebrada para sempre? Há promise sem tratamento de erro (pode derrubar o processo)? Quem chama o shutdown e ele libera conexões e timers? |
| **Tempo** | O resultado depende do relógio de cada instância? E se dois processos tiverem relógios diferentes? Há divisão por zero, NaN, valores negativos ou enormes vindos da config? |
| **Estado compartilhado/concorrência** | Com 2+ instâncias o estado é realmente compartilhado? Há leitura-modificação-escrita sem atomicidade? |
| **Entrada do atacante** | O valor é confiável (headers de proxy, IP)? Vira chave de cache/mapa/métrica (cardinalidade ilimitada esgota memória)? Dá para contornar o controle (variações de path, maiúsculas, barra final, IPv4 vs IPv6, múltiplos headers)? Chega a comando, query, regex ou log sem sanitização? Payload gigante ou operação cara por requisição? |
| **Dados e segredos** | Segredos em log, resposta de erro ou no pacote? Defaults inseguros (sem senha/TLS)? Dependências com vulnerabilidade conhecida (`npm audit` / `pip-audit`)? |
| **Compatibilidade** | Alguma assinatura mudou (síncrono→assíncrono, tipo de retorno) e os chamadores existentes foram atualizados? Algo que antes era chamado deixou de ser (ex.: limpeza/shutdown removido)? |

### Fase 4 — Promessa vs Realidade
Compare o que **README, docs de design e `.env.example` PROMETEM** com o que o código **FAZ**:
- Variáveis documentadas e nunca lidas
- Alegações ("compatível", "thread-safe", "sem race condition", "cobertura completa") sem sustentação
- Cenários listados no design que **não existem nos testes**

### Fase 5 — Dependências Reais
Os testes pulados e os cenários de falha só valem contra a **coisa real**. Detecte o que existe no ambiente (`which redis-server`, `docker ps`, etc.), suba a dependência localmente numa porta de teste e rode os testes que estavam pulados. Se não puder subir, **declare isso no relatório**; não finja ter verificado.

### Fase 6 — Sondar Cada Hipótese
Para cada **H<n>**: escreva o **MENOR script possível (fora do projeto)** que provoca o cenário, rode, compare com a previsão e **apague o script**.

Exemplos de sonda:
- Duas instâncias do componente em paralelo contra o mesmo estado
- Config extrema (valores 0, negativos, gigantes)
- Apontar para uma porta fechada / dependência indisponível
- Matar e religar a dependência (simular failover)
- Enviar o header suspeito (X-Forwarded-For malformado, IP spoofing, path traversal)

**Registre a saída REAL** (stdout, stderr, código de saída, tempo, logs).

### Fase 7 — Classificar com Honestidade
Cada achado recebe **exatamente um rótulo**:

| Rótulo | Definição |
|---|---|
| **COMPROVADO** | Você executou e viu a saída que prova. |
| **HIPÓTESE** | Dedução lógica do código que você **NÃO conseguiu executar**. Diga o que faltou para provar. Não descarte; reporte como hipótese. |
| **REFUTADO** | Você suspeitou, testou e estava errado. Registre em uma linha (isso mostra o que já foi verificado). |

**Nunca escreva "testei" ou "verifiquei" sobre algo que você só leu.**

### Fase 8 — Relatório
Por achado: **ID, severidade (CRÍTICA/ALTA/MÉDIA/BAIXA), rótulo, resumo, comando de prova, saída observada, esperado, teste que falha (para COMPROVADO) e correção sugerida em 1-3 linhas**. Não reescreva o código. **Máximo 12 achados, sem duplicatas**.

Termine com:
- **APROVADO** — zero CRÍTICA/ALTA comprovadas abertas
- **BLOQUEADO** — existe ao menos uma CRÍTICA/ALTA comprovada

**Severidade:**
- **CRÍTICA** = não builda/sobe ou cai em falha comum
- **ALTA** = bypass de controle, regra de negócio falha em silêncio, não se recupera de falha, DoS fácil
- **MÉDIA** = degradação, contrato falso, config morta
- **BAIXA** = higiene, estilo, warning

---

## Na Segunda Rodada (se BLOQUEADO na primeira)
1. **Releia só o que mudou** (diff)
2. **Reexecute a Fase 2 completa** (instalação limpa → build → produção → chamar)
3. **Reexecute as sondas dos achados anteriores** (verificar se correção resolveu)
4. **Procure REGRESSÕES**: correção que removeu algo que antes funcionava ou mudou um contrato

Se restar achado CRÍTICO/ALTO após 2 rodadas → **informe o usuário**; não declare "concluído".

---

## Exemplo de Relatório (Template)

```markdown
# Adversarial Review Report — <feature-name> — Rodada <1|2>

## Veredito: BLOQUEADO | APROVADO

## Achados

### H1 — COMPROVADO — CRÍTICA
**Resumo:** Lua script não carrega no build de produção (arquivo .lua não incluído no dist/)
**Comando:** `npm run build && ls dist/utils/lua/`
**Saída:** `ls: cannot access 'dist/utils/lua/': No such file or directory`
**Esperado:** `token_bucket_take.lua` presente
**Teste que falha:** Integração Redis falha em produção com "script not found"
**Correção:** Adicionar `"assets": ["src/utils/lua/**/*.lua"]` no `package.json` ou copiar no script de build

### H2 — HIPÓTESE — ALTA
**Resumo:** TTL de 10 min pode expirar bucket durante requisição longa (>10min), permitindo burst extra
**Previsão:** Requisição de 11min com 10 req iniciais → 11ª passa (bucket recriado com capacity cheia)
**Como provar:** Fake timer avançar 11min + 1 req → verificar allowed=true
**O que faltou:** Fake timers não cobrem cenário de req longa real; precisa teste de integração com clock real

### H3 — REFUTADO — MÉDIA
**Resumo:** Suspeita de race condition no Redis (duas instâncias)
**Teste:** 2 processos paralelos × 15 req cada contra mesmo IP → total allowed = 10 (correto)
**Saída:** Atomicidade do EVALSHA confirmada

---

## Resumo por Severidade
- CRÍTICA: 1 (H1)
- ALTA: 1 (H2)
- MÉDIA: 0
- BAIXA: 0
```

---

## Checklist Rápido do Revisor (antes de emitir veredito)

- [ ] Fase 0: Projeto copiado para diretório isolado
- [ ] Fase 1: Mapa de fronteiras completo (a–e)
- [ ] Fase 2: Build + execução produção + curl real funcionam
- [ ] Fase 3: Hipóteses numeradas com previsão escrita ANTES de testar
- [ ] Fase 4: Promessas do README vs código conferidas
- [ ] Fase 5: Dependências reais subidas e testes skipped rodados
- [ ] Fase 6: Cada H<n> sondada com script mínimo, script apagado
- [ ] Fase 7: Cada achado classificado (COMPROVADO/HIPÓTESE/REFUTADO)
- [ ] Fase 8: Relatório ≤12 achados, sem duplicatas, veredito claro
- [ ] Segunda rodada (se BLOQUEADO): diff lido, Fase 2 reexecutada, regressões checadas