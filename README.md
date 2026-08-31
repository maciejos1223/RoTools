# RoTools — Roblox MCP Tool

An **MCP server** for Claude that provides 3D model generation, AI audio (SFX, voice lines, music) and automatic asset import into Roblox Studio — plus a local **web dashboard with a live 3D preview** (dark sleek UI, EN/PL).

```
Claude (MCP Client)
        ↓ stdio
RoTools Server (Node.js)  ──→  http://localhost:7890  ←──  Frontend (React + three.js)
        │                                   ↑ poll /roblox/next
        │                                   ↓ POST /roblox/result
        └── Roblox Studio Plugin (Lua)  →  EditableMesh → MeshPart in Workspace
```

## Components

| Directory | Description |
|---|---|
| `server/` | MCP server (stdio) + HTTP API + SSE live events + GLB/OBJ writers (no DOM dependencies) |
| `frontend/` | Vite + React + Tailwind v4 + react-three-fiber — model preview, review actions, live activity log |
| `roblox-plugin/` | Roblox Studio plugin (Lua) — polls for imports, builds MeshParts |

## MCP Tools

| Tool | Description |
|---|---|
| `generate_model` | Executes Claude's Three.js code headlessly, exports GLB + OBJ, sets the model as *pending* for review |
| `export_model` | Exports the latest model to `.glb` / `.gltf` / `.obj`(+`.mtl`) into `exports/` |
| `generate_sfx` | Prompt → audio. `kind`: **sfx** (ElevenLabs / custom), **voice** (Google Gemini TTS), **music** (Google Lyria) |
| `import_to_roblox` | Queues the import for the Roblox Studio plugin (rebuilds it as MeshParts) and waits for the result |
| `get_status` | Server status: Studio plugin, pending model, assets, recent activity |

## Installation

```bash
npm install        # root (workspaces: server + frontend)
```

Requires **Node.js ≥ 20**.

## Running

```bash
npm run dev        # server (http://localhost:7890) + frontend (Vite, http://localhost:5173)
```

Production:

```bash
npm run build      # builds frontend/dist
npm start          # server serves the built frontend at http://localhost:7890
```

## Connecting to Claude Desktop

In `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "rotools": {
      "command": "node",
      "args": ["D:\\Roblox\\RoTools\\server\\index.js"]
    }
  }
}
```

Restart Claude Desktop and try:

> "Make me a mossy rock with textures and import it into Studio"

Claude calls `generate_model` → the 3D preview appears at http://localhost:7890 → click **Accept / Reject / Regenerate** → `import_to_roblox` builds the model in Studio.

## Connecting any other AI client

The server speaks **standard MCP** over two transports:

1. **stdio** — run `node D:\Roblox\RoTools\server\index.js` as the command (works with Claude Desktop, Cline, Continue, …)
2. **Streamable HTTP** — point the client at `http://localhost:7890/mcp` (works with Cursor, opencode, Windsurf, Claude Code remote, …)

Examples:

**Cursor** (`~/.cursor/mcp.json`):
```json
{ "mcpServers": { "rotools": { "url": "http://localhost:7890/mcp" } } }
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`):
```json
{ "mcpServers": { "rotools": { "serverUrl": "http://localhost:7890/mcp" } } }
```

**Cline** (VS Code settings → MCP Servers):
```json
{ "rotools": { "transportType": "http", "url": "http://localhost:7890/mcp" } }
```

**Claude Code** (terminal):
```bash
claude mcp add rotools --transport http http://localhost:7890/mcp
```

**opencode** (project `opencode.json` — already included in this repo):
```json
{ "mcp": { "rotools": { "type": "remote", "url": "http://localhost:7890/mcp", "enabled": true } } }
```

All clients get the same 5 tools; the frontend at http://localhost:7890 stays the review/dashboard layer regardless of which AI drives the server.

## Audio providers (SFX / Voice / Music)

`server/config.json`:

```json
{
  "sfx": {
    "provider": "elevenlabs",
    "api_key": "your-elevenlabs-key",
    "google_api_key": "your-gemini-key",
    "voice": "Kore",
    "model": "gemini-3.1-flash-tts-preview"
  },
  "music": {
    "provider": "google",
    "model": "lyria-3-clip-preview",
    "api_key": ""
  },
  "export": { "default_format": "gltf", "output_dir": "./exports" }
}
```

| kind | Provider | API key source |
|---|---|---|
| `sfx` | `elevenlabs` (Sound Generation) | `sfx.api_key` or `ELEVENLABS_API_KEY` |
| `sfx` | `google` (Gemini TTS — stylized voice lines) | `sfx.google_api_key` or `GEMINI_API_KEY` |
| `music` | `google` (Lyria 3 — full music tracks, 44.1 kHz stereo MP3) | `music.api_key`, `sfx.google_api_key` or `GEMINI_API_KEY` |
| any | `custom` (any REST endpoint: POST JSON `{prompt, duration}` → audio bytes) | `sfx.endpoint` / `music.endpoint` + optional Bearer key |

Google keys can be created at [Google AI Studio](https://aistudio.google.com/apikey).

### In-app settings

You don't have to edit `config.json` by hand — click the **gear icon** in the frontend header:

- edit **all** config values (API keys, providers, models, port, export dir),
- API key inputs show `••••last4` when set; typing a new value replaces it, **Clear** resets it,
- **Test** buttons verify the ElevenLabs / Google keys against the real API,
- everything is saved to `server/config.json`; provider/model changes apply immediately (port and output dir need a server restart).

## Roblox Studio plugin

1. Copy `roblox-plugin/RobloxMCPPlugin.lua` to:
   `%LOCALAPPDATA%\Roblox\Plugins\RobloxMCPPlugin.lua`
2. Restart Studio — the plugin **auto-starts** and adds a *RoTools* toolbar button (click to toggle).
3. If prompted: enable **Allow HTTP Requests** (Game Settings → Security) and the **EditableMesh** beta (File → Beta Features).
4. The **Roblox Studio** status pill in the frontend turns green once the plugin connects.

Imported models appear as a `Model` in Workspace (MeshParts, Y-up, 1:1 scale with the preview).

## Frontend overview

- **3D preview** — orbit, auto-rotate, texture/wireframe toggles; bottom panel with **Accept / Reject / Regenerate** (Reject/Regenerate accept optional feedback for Claude).
- **Assets** — accepted models with copyable IDs, **Import** to Studio, GLB download.
- **Sound FX** — player for generated audio (SFX / Voice / Music tabs) + manual generation form.
- **Activity** — live (SSE) log of everything: generations, reviews, imports, plugin connections.
- **Status pills**: Live (SSE), API, Roblox Studio (plugin).
- **Language**: EN / PL toggle in the header (persisted in localStorage).

## Tests

```bash
node server/test/smoke.js   # sandbox + GLB/GLTF/OBJ writers
node server/test/config.js  # settings API (masking, patching, key guard)
node server/test/http-mcp.js # MCP over Streamable HTTP (URL transport)
node server/test/e2e.js     # full flow: MCP client → generate → accept → import → export
```

## Notes

- Studio **cannot listen on HTTP**, so the plugin *polls* the server (`GET /roblox/next` every 1.5 s) — imports only work while Studio is open.
- Textures are generated procedurally (no Canvas/DOM) and baked into the GLB as PNGs — they also render in the viewer.
- `import_to_roblox` waits up to 2 minutes for the plugin; if Studio is closed the tool returns a clear error.
- Google audio: TTS returns 24 kHz PCM (wrapped to WAV by the server), Lyria returns MP3 directly.
