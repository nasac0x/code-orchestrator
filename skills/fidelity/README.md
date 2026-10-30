# fidelity

Clone a design as a pixel-faithful build, verified by measurement.

The skill is driven by an agent (see `SKILL.md`), but everything it does is a CLI you
can run yourself. `spec.json` is the single source of truth; the documents are generated.

## Quickstart

```powershell
cd "$HOME/.agents/skills/fidelity/scripts"
if (-not (Test-Path node_modules)) { npm install }

# 1. capture a reference (4 widths)
node extract.mjs --url http://localhost:3000 --out import --widths 390,768,1024,1440

# 2. look at it without burning context
node digest.mjs --dir import --width 1440 --outline

# 3. real breakpoints
node breaks.mjs --url http://localhost:3000 --out import/breaks.json

# 4. spec -> documents
node spec.mjs init  --dir import --width 1440 --out spec/spec.json --name "Acme"
node spec.mjs check --spec spec/spec.json
node spec.mjs build --spec spec/spec.json --project .

# 5. build, then prove it
node serve.mjs --root . --port 4173
node validate.mjs  --checks validation.json --out report --url http://localhost:4173
node visual-diff.mjs --pairs pairs.json --out visual-report
node budgets.mjs   --url http://localhost:4173 --spec spec/spec.json --out budgets
node verify.mjs    gate --dir . --require validate,visual,budgets
```

No reference? `node gen.mjs --name "Northwind" --niche saas --locale pt-BR --out ...`
writes a complete site (tokens, 9 blocks, validation suite). See `references/generator.md`.

## Fonts

Never hotlink. `node assets.mjs fonts-local --spec spec/spec.json` downloads the woff2
(`latin,latin-ext` by default), verifies the `wOF2` magic, and writes
`assets/fonts/fonts.css` + `fonts.json` (sha256, source, licence note). Link that CSS and
drop the Google `<link>`. `assets.mjs search --query "manrope"` resolves names/weights
from the Google Fonts metadata API (`GOOGLE_FONTS_API_KEY`, environment or config file).

## Credentials

`~/.fidelity.json` (user-level, outside the repo) holds the optional keys:

```json
{ "figma": { "token": "figd_…", "file": "" },
  "googleFonts": { "key": "AIza…" },
  "judge": { "url": "https://generativelanguage.googleapis.com/v1beta/openai",
             "key": "…", "model": "gemini-3.8-flash" } }
```

Environment overrides the file: `FIGMA_TOKEN`, `GOOGLE_FONTS_API_KEY`,
`FIDELITY_JUDGE_URL/KEY/MODEL`. Tokens are only read, never printed. Rotate any token
that has been pasted into a chat or a commit.

## Layout

```
SKILL.md                 router: rules, pipeline, token budget
ROADMAP.md               what is done / what is next
rules/pitfalls.jsonl     failures as data (36 rules); rules/pitfalls.md is generated
references/              spec-template.md, generator.md
scripts/                 the pipeline; node syntax.mjs checks all of it
runs/<date>-<name>/      archived one-off scripts from live runs
```

## Conventions

- One JSON summary line per run; failures print with the measured value.
- Every value in generated CSS carries the measurements it came from.
- Lint errors block generation (`exit 1`); warnings do not.
- A green DOM validation without a visual diff is **unverified**.
