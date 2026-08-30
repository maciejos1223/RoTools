import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULTS = {
  port: 7890,
  roblox_plugin_port: 7890,
  sfx: { provider: 'elevenlabs', api_key: '', google_api_key: '', endpoint: '', voice: 'Kore', model: 'gemini-3.1-flash-tts-preview' },
  music: { provider: 'google', model: 'lyria-3-clip-preview', api_key: '', endpoint: '' },
  export: { default_format: 'gltf', output_dir: './exports' },
};

let cached = null;

const CONFIG_PATH = fileURLToPath(new URL('./config.json', import.meta.url));

export function loadConfig() {
  if (cached) return cached;
  let fileCfg = {};
  try {
    fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    // missing/invalid config — use defaults
  }
  cached = {
    ...DEFAULTS,
    ...fileCfg,
    sfx: { ...DEFAULTS.sfx, ...(fileCfg.sfx || {}) },
    music: { ...DEFAULTS.music, ...(fileCfg.music || {}) },
    export: { ...DEFAULTS.export, ...(fileCfg.export || {}) },
  };
  return cached;
}

/** Force next loadConfig() to re-read the file. */
export function invalidateConfig() {
  cached = null;
}

const SECRET_FIELDS = new Set(['sfx.api_key', 'sfx.google_api_key', 'music.api_key']);

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

/** Merge a validated patch into config.json (secrets: undefined=keep, ''=clear). */
export function saveConfigPatch(patch) {
  const file = readConfigFile();

  if (patch.port !== undefined) {
    const port = parseInt(patch.port, 10);
    if (!Number.isFinite(port) || port < 1024 || port > 65535) throw new Error('Invalid port (1024-65535)');
    file.port = port;
  }
  for (const section of ['sfx', 'music', 'export']) {
    if (patch[section] === undefined) continue;
    if (typeof patch[section] !== 'object' || patch[section] === null) throw new Error(`Invalid section "${section}"`);
    file[section] = { ...(DEFAULTS[section] || {}), ...(file[section] || {}), ...patch[section] };
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(file, null, 2) + '\n');
  invalidateConfig();
  return loadConfig();
}

/** Config safe to send to the frontend — secrets masked. */
export function maskConfig(cfg = loadConfig()) {
  const out = JSON.parse(JSON.stringify(cfg));
  for (const path of SECRET_FIELDS) {
    const [section, key] = path.split('.');
    const val = out[section]?.[key];
    if (val === undefined) continue;
    const isSet = typeof val === 'string' && val.length > 0;
    out[section][key] = { set: isSet, masked: isSet ? '••••' + val.slice(-4) : '' };
  }
  return out;
}

export function outputDir() {
  const serverRoot = path.dirname(CONFIG_PATH);
  const dir = path.resolve(serverRoot, loadConfig().export.output_dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sfx'), { recursive: true });
  return dir;
}
