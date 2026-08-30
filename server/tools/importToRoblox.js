import { randomUUID } from 'node:crypto';
import { getModel } from '../lib/modelStore.js';
import { queueImport } from '../lib/roblox.js';
import { activity, broadcast, state } from '../lib/state.js';

/**
 * Tool: import_to_roblox
 * Queues the model for the Roblox Studio plugin (which polls this server) and waits for the result.
 */
export async function importToRoblox({ modelId = null, name = null } = {}) {
  let source = null;
  if (modelId && getModel(modelId)) {
    source = { id: modelId, ...getModel(modelId) };
  } else if (state.pendingModel) {
    const pending = state.pendingModel;
    const stored = getModel(pending.id);
    if (!stored) throw new Error('Pending model data is no longer in memory (server restarted?). Regenerate the model.');
    source = { id: pending.id, name: pending.name, ...stored };
  } else {
    throw new Error('Nothing to import. Call generate_model first, or pass modelId of an accepted asset.');
  }

  if (!state.roblox.online && state.imports.length === 0) {
    activity('roblox', 'Warning: Roblox Studio plugin has not connected yet — import will wait for it', 'warn');
  }

  const assetId = `AST-${randomUUID().slice(0, 6).toUpperCase()}`;
  const importName = name || source.name;

  const { job, promise } = queueImport({ name: importName, model: source.modelData, assetId });

  let result;
  try {
    result = await promise;
  } catch (err) {
    return { ok: false, error: err.message, resultText: `Import failed: ${err.message}` };
  }

  // register as accepted asset in frontend
  const asset = {
    id: assetId,
    name: result.assetName || importName,
    modelId: source.id,
    glbUrl: `/api/models/${source.id}/file.glb`,
    objUrl: `/api/models/${source.id}/file.obj`,
    robloxRef: result.assetName,
    parts: result.parts,
    importedAt: new Date().toISOString(),
    imported: true,
    createdAt: new Date().toISOString(),
  };
  if (!state.assets.find((a) => a.id === assetId)) state.assets.unshift(asset);
  broadcast('asset', { action: 'created', asset });

  return {
    ok: true,
    assetId,
    robloxInstanceName: result.assetName,
    parts: result.parts,
    jobId: job.id,
    resultText: `Imported "${importName}" into Roblox Studio. Workspace model name: "${result.assetName}" (${result.parts} MeshPart(s)). Local asset ID: ${assetId}.`,
  };
}
