import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULTS = {
  port: 7890,
  roblox_plugin_port: 7890,
  sfx: { provider: 'elevenlabs', api_key: '', endpoint: '', model: 'eleven_multilingual_v2' },
  export: { default_format: 'gltf', output_dir: './exports' },
};

let cached = null;

export function loadConfig() {
  if (cached) return cached;
  let fileCfg = {};
  try {
    fileCfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
  } catch {
    // missing/invalid config — use defaults
  }
  cached = {
    ...DEFAULTS,
    ...fileCfg,
    sfx: { ...DEFAULTS.sfx, ...(fileCfg.sfx || {}) },
    export: { ...DEFAULTS.export, ...(fileCfg.export || {}) },
  };
  return cached;
}

export function outputDir() {
  const serverRoot = path.dirname(fileURLToPath(new URL('../config.json', import.meta.url)));
  const dir = path.resolve(serverRoot, loadConfig().export.output_dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sfx'), { recursive: true });
  return dir;
}
