import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config.js';
import { activity, broadcast } from './state.js';

/* ---------- helpers ---------- */

function pcmToWav(pcm, { sampleRate = 24000, channels = 1, bits = 16 } = {}) {
  const blockAlign = (channels * bits) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * blockAlign) | 0, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function slugify(text, fallback = 'audio') {
  return (
    String(text).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || fallback
  );
}

/* ---------- Google (Gemini) ---------- */

let _googleClient = null;
async function googleClient(cfg) {
  if (_googleClient) return _googleClient;
  const { GoogleGenAI } = await import('@google/genai');
  _googleClient = new GoogleGenAI({ apiKey: cfg });
  return _googleClient;
}

/** Gemini TTS — spoken audio / stylized voice lines (24kHz PCM -> WAV). */
async function googleTts({ prompt, apiKey, voice, model }) {
  const ai = await googleClient(apiKey);
  const interaction = await ai.interactions.create({
    model: model || 'gemini-3.1-flash-tts-preview',
    input: prompt,
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice: voice || 'Kore' }] },
  });
  const b64 = interaction?.output_audio?.data;
  if (!b64) throw new Error('Gemini TTS returned no audio');
  const pcm = Buffer.from(b64, 'base64');
  return { audio: pcmToWav(pcm), format: 'wav', model: model || 'gemini-3.1-flash-tts-preview', extra: {} };
}

/** Lyria 3 — music generation (44.1kHz stereo MP3). */
async function googleMusic({ prompt, apiKey, model }) {
  const ai = await googleClient(apiKey);
  const interaction = await ai.interactions.create({
    model: model || 'lyria-3-clip-preview',
    input: prompt,
  });
  const b64 = interaction?.output_audio?.data;
  if (!b64) throw new Error('Lyria returned no audio');
  return {
    audio: Buffer.from(b64, 'base64'),
    format: 'mp3',
    model: model || 'lyria-3-clip-preview',
    extra: { lyrics: interaction?.output_text || null },
  };
}

/* ---------- providers ---------- */

async function elevenLabs({ prompt, duration, apiKey }) {
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
  const bytes = Buffer.from(await res.arrayBuffer());
  const format = res.headers.get('content-type')?.includes('wav') ? 'wav' : 'mp3';
  return { audio: bytes, format, model: 'sound-generation', extra: {} };
}

async function customEndpoint({ prompt, duration, endpoint, apiKey }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ prompt, duration }),
  });
  if (!res.ok) throw new Error(`SFX API error ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const format = res.headers.get('content-type')?.includes('wav') ? 'wav' : 'mp3';
  return { audio: bytes, format, model: 'custom', extra: {} };
}

/* ---------- main ---------- */

/**
 * Generate audio (SFX, voice or music) via the configured provider.
 * kind: 'sfx' | 'voice' -> sfx provider (elevenlabs | google TTS | custom)
 * kind: 'music'         -> music provider (google Lyria | custom)
 */
export async function generateSfx({ prompt, duration = null, name = null, kind = 'sfx' }) {
  const cfg = loadConfig();
  const isMusic = kind === 'music';
  const sfxCfg = cfg.sfx;
  const musicCfg = cfg.music || {};

  const apiKey = isMusic
    ? musicCfg.api_key || sfxCfg.google_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    : sfxCfg.provider === 'google'
      ? sfxCfg.google_api_key || sfxCfg.api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      : sfxCfg.api_key || process.env.SFX_API_KEY || process.env.ELEVENLABS_API_KEY;

  const provider = isMusic ? (musicCfg.provider || 'google') : sfxCfg.provider || 'elevenlabs';

  if (!apiKey) {
    throw new Error(
      `No API key for provider "${provider}". Set ${isMusic ? 'music.api_key' : 'sfx.api_key'} in server/config.json` +
        (provider === 'google' || isMusic ? ' or GEMINI_API_KEY env var.' : '.')
    );
  }

  activity('sfx', `Generating ${kind} via ${provider}: "${prompt.slice(0, 80)}"`, 'info');

  let result;
  if (isMusic && provider === 'google') {
    result = await googleMusic({ prompt, apiKey, model: musicCfg.model });
  } else if (isMusic && provider === 'custom') {
    if (!musicCfg.endpoint) throw new Error('Custom music provider requires music.endpoint in config.json');
    result = await customEndpoint({ prompt, duration, endpoint: musicCfg.endpoint, apiKey });
  } else if (provider === 'google') {
    result = await googleTts({ prompt, apiKey, voice: sfxCfg.voice, model: sfxCfg.model });
  } else if (provider === 'elevenlabs') {
    result = await elevenLabs({ prompt, duration, apiKey });
  } else if (provider === 'custom') {
    if (!sfxCfg.endpoint) throw new Error('Custom SFX provider requires sfx.endpoint in config.json');
    result = await customEndpoint({ prompt, duration, endpoint: sfxCfg.endpoint, apiKey });
  } else {
    throw new Error(`Unknown provider "${provider}"`);
  }

  const sfxDir = path.join(cfg.export.output_dir, 'sfx');
  fs.mkdirSync(sfxDir, { recursive: true });

  const id = `sfx_${randomUUID().slice(0, 8)}`;
  const base = slugify(name || prompt, kind);
  const file = path.join(sfxDir, `${id}_${base}.${result.format}`);
  fs.writeFileSync(file, result.audio);

  const record = {
    id,
    kind: isMusic ? 'music' : 'sfx',
    prompt,
    provider,
    model: result.model,
    format: result.format,
    bytes: result.audio.length,
    file,
    url: `/api/sfx/${id}/file`,
    name: `${base}.${result.format}`,
    lyrics: result.extra.lyrics || null,
    createdAt: new Date().toISOString(),
  };
  broadcast('sfx', { action: 'generated', sfx: record });
  activity('sfx', `${isMusic ? 'Music' : 'SFX'} ready: ${record.name} (${(record.bytes / 1024).toFixed(0)} KB)`, 'success');
  return record;
}
