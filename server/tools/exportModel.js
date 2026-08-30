import { getModel } from '../lib/modelStore.js';
import { writeExportFile } from '../lib/modelStore.js';
import { buildGLB, buildOBJ } from '../lib/gltf.js';
import { state } from '../lib/state.js';
import { loadConfig } from '../config.js';

/**
 * Tool: export_model
 * Exports the most recent generated model to GLB/GLTF/OBJ in the exports dir.
 */
export async function exportModel({ format = null, modelId = null } = {}) {
  const cfg = loadConfig();
  const fmt = (format || cfg.export.default_format || 'gltf').toLowerCase();

  const id = modelId || state.pendingModel?.id;
  const name = modelId ? getModel(modelId)?.name : state.pendingModel?.name;
  if (!id || !getModel(id)) {
    throw new Error('No model available to export. Call generate_model first (or pass a valid modelId).');
  }
  const { modelData } = getModel(id);
  const slug = (name || 'model').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (fmt === 'obj') {
    const { obj, mtl, mtlName, textures } = buildOBJ({ name, objects: modelData.objects }, { textures: true });
    const base = `${stamp}_${slug}`;
    const files = [writeExportFile(`${base}.obj`, obj), writeExportFile(`${base}.mtl`, mtl)];
    for (const [tn, buf] of textures) files.push(writeExportFile(tn, buf));
    return { format: 'obj', files };
  }

  if (fmt === 'gltf') {
    // .gltf (JSON + embedded base64 buffer)
    const glb = buildGLB({ name, objects: modelData.objects }, { textures: true });
    // parse GLB back: header 12, json chunk
    const jsonLen = glb.readUInt32LE(12);
    const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
    const binLen = glb.readUInt32LE(20 + jsonLen);
    const bin = glb.subarray(20 + jsonLen + 8, 20 + jsonLen + 8 + binLen);
    json.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
    const p = writeExportFile(`${stamp}_${slug}.gltf`, JSON.stringify(json));
    return { format: 'gltf', files: [p] };
  }

  // default: glb
  const buf = buildGLB({ name, objects: modelData.objects }, { textures: true });
  const p = writeExportFile(`${stamp}_${slug}.glb`, buf);
  return { format: 'glb', files: [p] };
}
