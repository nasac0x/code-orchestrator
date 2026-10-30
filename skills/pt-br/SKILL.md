---
name: pt-br
description: Responder sempre em português brasileiro (pt-BR) em toda a saída conversacional — explicações, resumos, planos, revisões de código, mensagens de commit e documentação escrita para o usuário. Use sempre que o usuário escrever em português, quando pedir explicitamente "fala em português brasileiro", ou quando quiser garantir o idioma e as convenções do pt-BR na resposta.
---

# Português brasileiro (pt-BR)

**Regra única: escreva sempre em português do Brasil.**

Aplica-se a todo texto destinado ao usuário: explicações, resumos, planos,
revisões de código, mensagens de commit, descrições de branch e documentação.

## O que NÃO se traduz

Mantenha literalmente, mesmo dentro de uma frase em português:

- código, identificadores, nomes de arquivo e caminhos (`main.ts`, `useState`)
- comandos e ferramentas (`git commit`, `npm install`, `Select-String`)
- bibliotecas, frameworks e APIs (`Bun.serve`, `React`, `Tailwind`)
- mensagens de erro, logs e stack traces citados
- texto que o código exige literalmente (string literals obrigatórias)

## Convenções do pt-BR

- **Pronome:** "você" — nunca "tu".
- **Vocabulário:** arquivo (não "ficheiro"), tela (não "ecrã"), pasta
  (não "directoria"), usuário (não "utilizador"), site, resposta, programação.
- **Acentuação e ortografia** do pt-BR, sem ortografia europeia:
  "atualização" (não "actualização"), "objeto" (não "objecto"),
  "interface" (não "interface" europeu soletrado).
- **Datas:** dd/mm/aaaa. **Números decimais:** com vírgula (`0,7 MB`).
- **Termos técnicos:** use o equivalente consensual em pt-BR — repositório,
  branch, commit, deploy, build, testes, cobertura, requisição, middleware.

## Como escrever

- Frases diretas e curtas. Prefira voz ativa.
- Explique o **porquê**, não apenas o como.
- Ao apresentar opções ou trade-offs para o usuário escolher, escreva em pt-BR.
- Se o usuário escrever em outro idioma, ainda assim responda em pt-BR.
- Não peça desculpas pelo idioma nem ofereça trocar de idioma — apenas
  responda em pt-BR.

## Commits

Mensagens de commit seguem a convenção do projeto. Na ausência de convenção
explícita, escreva o assunto em português do Brasil, imperativo e sem ponto
final (`adiciona verificação de hash`).
