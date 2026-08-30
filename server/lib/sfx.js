import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config.js';
import { activity, broadcast } from './state.js';

/**
 * Generate SFX via configured provider, save to exports/sfx.
 * Returns sfx record { id, prompt, file, format, url, bytes, durationHint }
 */
export async function generateSfx({ prompt, duration = null, name = null }) {
  const cfg = loadConfig();
  const provider = cfg.sfx.provider || 'elevenlabs';
  const apiKey = cfg.sfx.api_key || process.env.SFX_API_KEY || process.env.ELEVENLABS_API_KEY;
  if (!apiKey && provider !== 'custom') {
    throw new Error(`No SFX API key configured. Set sfx.api_key in server/config.json (provider: ${provider}).`);
  }

  const sfxDir = path.join(cfg.export.output_dir, 'sfx');
  fs.mkdirSync(sfxDir, { recursive: true });

  activity('sfx', `Generating SFX via ${provider}: "${prompt}"`, 'info');

  let bytes;
  let format = 'mp3';

  if (provider === 'elevenlabs') {
    const body = { text: prompt, prompt_influence: 0.7 };
    if (duration) body.duration_seconds = Math.min(22, Math.max(0.5, Number(duration)));
    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ElevenLabs API error ${res.status}: ${text.slice(0, 300)}`);
    }
    bytes = Buffer.from(await res.arrayBuffer());
    format = res.headers.get('content-type')?.includes('wav') ? 'wav' : 'mp3';
  } else {
    // Generic REST provider: POST JSON {prompt, duration} -> audio bytes
    if (!cfg.sfx.endpoint) throw new Error('Custom SFX provider requires sfx.endpoint in config.json');
    const res = await fetch(cfg.sfx.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ prompt, duration }),
    });
    if (!res.ok) throw new Error(`SFX API error ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    format = res.headers.get('content-type')?.includes('wav') ? 'wav' : 'mp3';
  }

  const id = `sfx_${randomUUID().slice(0, 8)}`;
  const slug = (name || prompt).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'sfx';
  const file = path.join(sfxDir, `${id}_${slug}.${format}`);
  fs.writeFileSync(file, bytes);

  const record = {
    id,
    prompt,
    provider,
    format,
    bytes: bytes.length,
    file,
    url: `/api/sfx/${id}/file`,
    name: `${slug}.${format}`,
    createdAt: new Date().toISOString(),
  };
  broadcast('sfx', { action: 'generated', sfx: record });
  activity('sfx', `SFX ready: ${record.name} (${(bytes.length / 1024).toFixed(0)} KB)`, 'success');
  return record;
}
