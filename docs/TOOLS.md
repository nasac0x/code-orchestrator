# External tools routing

Three tools the orchestrator routes to when a task needs execution power
beyond language and code. Two live outside the `skills/` database (installed
in the agent environment); one is bundled.

| Intent | Tool | Type | Install (warm-up command) | Where it comes from | License |
|---|---|---|---|---|---|
| browser automation & testing | `agent-browser` | CLI (Rust, native binary) bundled in npm | `npm install -g agent-browser && agent-browser install` | https://github.com/vercel-labs/agent-browser | Apache-2.0 |
| video / audio | `ffmpeg-skill` | bundled skill folder under `skills/ffmpeg-skill/` (42 tools, requires `ffmpeg` + `python3` on PATH) | `npx ffmpeg-skill` (optional MCP server included) | https://github.com/kajisho5/ffmpeg-skill | MIT |
| diagrams / whiteboard | `excalidraw-mcp` | remote MCP App | URL: `https://mcp.excalidraw.com` | https://github.com/excalidraw/excalidraw-mcp | MIT |

## Why these are not all inside `skills/`

- `ffmpeg-skill` follows the same pattern as all bundled skills: a folder with
  `SKILL.md` plus its scripts references, loaded on demand by the orchestrator.
- `agent-browser` **serves its own skills** bundled inside the CLI binary
  (`agent-browser skills get`). Copying those files into a hub would freeze a
  moving target - we route to the CLI and let it self-detail.
- `excalidraw-mcp` is a server process/endpoint, not a skill. The orchestrator
  routes intent to the MCP protocol; the environment (e.g. OpenCode, the user's
  client) declares the server.

Check always:
- `agent-browser doctor`
- `npx ffmpeg-skill doctor` (must report zero required capabilities missing)
- MCP resource listing (excalidraw)'s URI is available

## Example routing

| User request | Route taken |
|---|---|
| "abra example.com e teste se o titulo da pagina e... " | `external:agent-browser` CLI commands |
| "corta esses 60 segundos do meu video de ate 3:10 e bota legenda tiktok" | `ffmpeg-skill` -> cut.py, fit.py, caption.py, check.py |
| "desenha um diagrama de arquitetura do pipeline do orquestrador" | `external:excalidraw-mcp` MCP tools |
