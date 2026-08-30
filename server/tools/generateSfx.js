import { generateSfx } from '../lib/sfx.js';

/**
 * Tool: generate_sfx
 */
export async function generateSfxTool({ prompt, duration = null, name = null }) {
  const record = await generateSfx({ prompt, duration, name });
  return {
    sfxId: record.id,
    file: record.file,
    format: record.format,
    bytes: record.bytes,
    url: record.url,
    resultText: `SFX "${record.name}" (${record.id}) generated via ${record.provider} and saved to ${record.file}. The user can play it in the local frontend.`,
  };
}
