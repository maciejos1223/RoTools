\# Roblox MCP Tool – Specyfikacja Projektu



\## Cel



Narzędzie działające jako \*\*MCP serwer\*\* dla Claude'a, które daje mu dostęp do generowania modeli 3D, dźwięku SFX oraz automatycznego importu assetów do Roblox Studio – bez sterowania komputerem przez AI.



\---



\## Architektura ogólna



```

Claude (MCP Client)

&#x20;       ↓

MCP Server (Node.js)

&#x20;       ├── tool: generate\_model

&#x20;       ├── tool: export\_model

&#x20;       ├── tool: generate\_sfx

&#x20;       └── tool: import\_to\_roblox

&#x20;                       ↓

&#x20;             Roblox Studio Plugin (Lua)

&#x20;             nasłuchuje HTTP na localhost

```



\---



\## Komponenty



\### 1. MCP Server (Node.js)



Serce projektu. Claude łączy się z nim i ma dostęp do toolów.



\*\*Toole:\*\*



| Tool | Opis |

|---|---|

| `generate\_model` | Generuje geometrię 3D przez Three.js (kod JS) |

| `export\_model` | Eksportuje scenę Three.js do GLTF lub OBJ |

| `generate\_sfx` | Wysyła prompt do zewnętrznego API (klucz od użytkownika) |

| `import\_to\_roblox` | Wysyła plik GLTF na localhost do Roblox Studio Plugin |



\*\*Stack:\*\*

\- Node.js + `@anthropic-ai/mcp-sdk`

\- `three` + `three/examples/jsm/exporters/GLTFExporter`

\- `node-fetch` do komunikacji z pluginem i SFX API



\---



\### 2. Three.js Model Generator



Claude generuje kod Three.js opisujący geometrię (BoxGeometry, SphereGeometry, własne BufferGeometry itp.), MCP serwer go wykonuje w środowisku Node.js i eksportuje scenę.



\*\*Obsługiwane formaty eksportu:\*\*

\- `.gltf` / `.glb` – preferowany, obsługuje tekstury

\- `.obj` + `.mtl` – fallback



\*\*Tekstury:\*\*

\- Toggle w narzędziu – `with\_textures: true/false`

\- Jeśli włączone, Claude może wygenerować prostą teksturę proceduralnie (Canvas API) lub załadować z URL



\---



\### 3. SFX Generator



Użytkownik podaje:

\- Model AI (np. ElevenLabs, własne API)

\- Klucz API



Claude wywołuje tool `generate\_sfx` z promptem, MCP serwer wysyła request do wybranego API i zwraca plik audio (`.mp3` / `.wav`).



\*\*Obsługiwane API (przykłady):\*\*

\- ElevenLabs Sound Effects API

\- Dowolne API kompatybilne z REST



\---



\### 4. Roblox Studio Plugin (Lua)



Plugin instalowany lokalnie w Roblox Studio. Nasłuchuje na `localhost:PORT` przez `HttpService`.



\*\*Działanie:\*\*

1\. MCP serwer wysyła POST z plikiem GLTF na `http://localhost:7890/import`

2\. Plugin odbiera plik

3\. Importuje model przez `AssetService:PromptImportAssetAsync()` lub wstawia przez `InsertService`

4\. Zwraca ID assetu (jeśli upload do Roblox cloud) lub nazwę w workspace



\*\*Ważne:\*\*

\- `HttpService` w Studio musi mieć włączone `AllowedUrls` dla localhost

\- Plugin działa tylko gdy Studio jest otwarte



\---



\### 5. Frontend (Podgląd modeli)



Prosta aplikacja webowa (React + Three.js viewer) uruchamiana lokalnie razem z MCP serwerem.



\*\*Funkcje:\*\*

\- Podgląd wygenerowanego modelu 3D w przeglądarce

\- Przyciski: \*\*Akceptuj\*\* / \*\*Odrzuć\*\* / \*\*Generuj ponownie\*\*

\- Toggle: \*\*Z teksturami / Bez tekstur\*\*

\- Lista zaakceptowanych assetów z ich ID (do skopiowania)

\- Podgląd/odtwarzanie wygenerowanych SFX



\---



\## Flow użytkownika



```

1\. Użytkownik uruchamia MCP Server lokalnie

2\. Podłącza go do Claude Desktop (config w claude\_desktop\_config.json)

3\. Uruchamia Roblox Studio z zainstalowanym pluginem

4\. Rozmawia z Claude: "Zrób mi skałę z teksturą"

5\. Claude → generate\_model → Three.js geometria → GLTF

6\. Frontend pokazuje podgląd → użytkownik akceptuje

7\. Claude → import\_to\_roblox → Plugin importuje do Studio

8\. Claude zwraca ID assetu

```



\---



\## Konfiguracja użytkownika



Plik `config.json` w katalogu MCP serwera:



```json

{

&#x20; "port": 7890,

&#x20; "roblox\_plugin\_port": 7890,

&#x20; "sfx": {

&#x20;   "provider": "elevenlabs",

&#x20;   "api\_key": "sk-...",

&#x20;   "model": "eleven\_multilingual\_v2"

&#x20; },

&#x20; "export": {

&#x20;   "default\_format": "gltf",

&#x20;   "output\_dir": "./exports"

&#x20; }

}

```



\---



\## Struktura plików projektu



```

roblox-mcp/

├── server/

│   ├── index.js          # MCP Server entry point

│   ├── tools/

│   │   ├── generateModel.js

│   │   ├── exportModel.js

│   │   ├── generateSfx.js

│   │   └── importToRoblox.js

│   └── config.json

├── frontend/

│   ├── src/

│   │   ├── App.jsx

│   │   ├── ModelViewer.jsx

│   │   └── AssetList.jsx

│   └── package.json

├── roblox-plugin/

│   └── RobloxMCPPlugin.lua

└── README.md

```



\---



\## Technologie



| Warstwa | Technologia |

|---|---|

| MCP Server | Node.js, `@anthropic-ai/mcp-sdk` |

| 3D Generation | Three.js, GLTFExporter |

| Frontend | React, Three.js (react-three-fiber) |

| SFX | REST API (ElevenLabs lub własne) |

| Roblox Plugin | Lua, HttpService |

| Komunikacja plugin↔server | HTTP localhost |



\---



\## Ograniczenia i uwagi



\- Auto-import do Roblox wymaga \*\*otwartego Roblox Studio\*\* z pluginem

\- Upload assetów do Roblox Cloud wymaga zalogowanego konta w Studio

\- `HttpService` w Studio obsługuje tylko HTTP (nie HTTPS) dla localhost

\- Roblox może wymagać ręcznej akceptacji importu assetów (dialog w Studio)



\---



\## Co dalej (roadmap)



\- \[ ] MCP Server – podstawowe toole

\- \[ ] Three.js generator + GLTF export

\- \[ ] Frontend viewer

\- \[ ] Roblox Studio Plugin (HTTP listener)

\- \[ ] SFX integration

\- \[ ] Tekstury (toggle)

\- \[ ] Asset ID manager w frontendzie

