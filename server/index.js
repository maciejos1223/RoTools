import { startApi } from './lib/api.js';
import { activity, state } from './lib/state.js';
import { loadConfig, outputDir } from './config.js';

const cfg = loadConfig();
outputDir();

// a local tool must survive stray errors instead of dying silently
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

await startApi();

console.log(`
  ┌─────────────────────────────────────────────┐
  │   RoTools — Roblox MCP Tool                 │
  └─────────────────────────────────────────────┘
   HTTP API + frontend : http://localhost:${cfg.port}
   SFX provider        : ${cfg.sfx.provider}${cfg.sfx.api_key ? ' (key set)' : ' — no API key!'}
   Exports dir         : ./exports
   Roblox plugin polls : GET /roblox/next every 1.5s
`);

activity('server', `RoTools server started on port ${cfg.port}`, 'success');

// mark plugin offline if it stops polling
setInterval(() => {
  if (state.roblox.online && Date.now() - state.roblox.lastSeen > 6000) {
    state.roblox.online = false;
    activity('roblox', 'Roblox Studio plugin disconnected', 'warn');
  }
}, 3000).unref();

// MCP stdio transport (disable with ROTOOLS_NO_MCP=1 for pure-web dev)
if (process.env.ROTOOLS_NO_MCP !== '1') {
  const { startMcp } = await import('./mcpServer.js');
  await startMcp();
}
