import { generateSfx } from '../lib/sfx.js';

/**
 * Tool: generate_sfx
 */
export async function generateSfxTool({ prompt, duration = null, name = null, kind = 'sfx' }) {
  const record = await generateSfx({ prompt, duration, name, kind });
  const what = record.kind === 'music' ? 'Music' : 'SFX';
  return {
    sfxId: record.id,
    kind: record.kind,
    provider: record.provider,
    model: record.model,
    file: record.file,
    format: record.format,
    bytes: record.bytes,
    url: record.url,
    lyrics: record.lyrics,
    resultText: `${what} "${record.name}" (${record.id}) generated via ${record.provider}/${record.model} and saved to ${record.file}.${record.lyrics ? `\nLyrics:\n${record.lyrics}` : ''} The user can play it in the local frontend.`,
  };
}
