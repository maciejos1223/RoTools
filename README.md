# RoTools — Roblox MCP Tool

Narzędzie działające jako **MCP serwer** dla Claude'a, które daje mu dostęp do generowania modeli 3D, dźwięku SFX oraz automatycznego importu assetów do Roblox Studio — plus lokalny **frontend z podglądem 3D** (dark sleek UI) na żywo.

```
Claude (MCP Client)
        ↓ stdio
RoTools Server (Node.js)  ──→  http://localhost:7890  ←──  Frontend (React + three.js)
        │                                   ↑ poll /roblox/next
        │                                   ↓ POST /roblox/result
        └── Roblox Studio Plugin (Lua)  →  EditableMesh → MeshPart w Workspace
```

## Komponenty

| Katalog | Opis |
|---|---|
| `server/` | MCP server (stdio) + HTTP API + SSE live events + GLB/OBJ writer (bez zależności DOM) |
| `frontend/` | Vite + React + Tailwind v4 + react-three-fiber — podgląd modeli, akcje, log aktywności |
| `roblox-plugin/` | Plugin do Roblox Studio (Lua) — poll importów, budowa MeshParts |

## Toole MCP

| Tool | Opis |
|---|---|
| `generate_model` | Wykonuje kod Three.js Claude'a w sandboxie Node, eksportuje GLB + OBJ, ustawia model jako *pending* do review |
| `export_model` | Eksport ostatniego modelu do `.glb` / `.gltf` / `.obj`(+`.mtl`) w `exports/` |
| `generate_sfx` | Prompt → SFX API (ElevenLabs lub własny REST), plik audio w `exports/sfx/` |
| `import_to_roblox` | Kolejkuje import do Roblox Studio (plugin odbiera i buduje meshe), czeka na wynik |
| `get_status` | Status serwera: plugin Studio, pending model, assety, aktywność |

## Instalacja

```bash
npm install        # root (workspaces: server + frontend)
```

Wymagania: **Node.js ≥ 20**.

## Uruchomienie

```bash
npm run dev        # server (http://localhost:7890) + frontend (Vite, http://localhost:5173)
```

Produkcyjnie:

```bash
npm run build      # buduje frontend/dist
npm start          # server serwuje zbudowany frontend na http://localhost:7890
```

> Po restarcie serwera frontend dev powinien się sam podłączyć (SSE + polling).

## Podłączenie do Claude Desktop

W `claude_desktop_config.json` (Settings → Developer → Edit Config):

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

Restart Claude Desktop — ikona RoTools pojawi się wśród narzędzi. Od tej pory możesz np.:

> „Zrób mi skałę z teksturą i zaimportuj do Studio"

Claude wywoła `generate_model` → w przeglądarce (http://localhost:7890) pojawi się podgląd 3D → klikasz **Accept / Reject / Regenerate** → `import_to_roblox` wstawia model do Studia.

## Konfiguracja SFX

`server/config.json`:

```json
{
  "port": 7890,
  "sfx": {
    "provider": "elevenlabs",
    "api_key": "twoj-klucz",
    "model": "eleven_multilingual_v2"
  },
  "export": { "default_format": "gltf", "output_dir": "./exports" }
}
```

Wspierane: `elevenlabs` (Sound Generation API) oraz `custom` (dowolny REST: POST JSON `{prompt, duration}` → audio binary; ustaw `sfx.endpoint`).

## Instalacja pluginu Roblox Studio

1. Skopiuj `roblox-plugin/RobloxMCPPlugin.lua` do:
   `%LOCALAPPDATA%\Roblox\Plugins\RobloxMCPPlugin.lua`
2. Zrestartuj Studio — plugin **auto-startuje** i pokaże się przycisk *RoTools* na toolbarze (klik = on/off).
3. Jeśli poprosi: włącz **Allow HTTP Requests** (Game Settings → Security) oraz beta **EditableMesh** (File → Beta Features).
4. W nagłówku frontendu kapsuła **Roblox Studio** zaświeci się na zielono, gdy plugin się połączy.

Przy imporcie model pojawia się jako `Model` w Workspace (MeshParts, Y-up, skala 1:1 z podglądem).

## Frontend — co gdzie

- **Podgląd 3D** — orbit, auto-rotate, toggle tekstur/wireframe; dolny panel **Accept / Reject / Regenerate** (Reject/Regenerate przyjmują feedback dla Claude'a).
- **Assets** — zaakceptowane modele z ID do skopiowania, przycisk **Import** do Studia, download GLB.
- **Sound FX** — odtwarzacz wygenerowanych dźwięków + ręczne generowanie z promptu.
- **Activity** — log na żywo (SSE) wszystkiego, co się dzieje: generacje, review, importy, połączenia pluginu.
- Kapsuły statusu: **Live** (SSE), **API**, **Roblox Studio** (plugin).

## Testy

```bash
node server/test/smoke.js   # sandbox + GLB/GLTF/OBJ writers
node server/test/e2e.js     # pełny przepływ: MCP client → generate → accept → import → export
```

## Uwagi

- Studio **nie może nasłuchiwać HTTP**, więc to plugin *polluje* serwer (`GET /roblox/next` co 1.5 s) — import zadziała, dopóki Studio jest otwarte.
- Tekstury są generowane proceduralnie (bez Canvas/DOM) i wpiekane do GLB jako PNG — działa też w viewerze.
- `import_to_roblox` czeka max 2 min na plugin; jeśli Studio jest zamknięte, tool zwróci stosowny błąd.
