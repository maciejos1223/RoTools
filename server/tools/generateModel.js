import { randomUUID } from 'node:crypto';
import { runModelCode } from '../lib/sandbox.js';
import { rememberModel, saveModelFiles } from '../lib/modelStore.js';
import { activity, broadcast, state } from '../lib/state.js';

/**
 * Tool: generate_model
 * Executes Claude's Three.js code headlessly, exports GLB+OBJ, sets the pending model.
 */
export async function generateModel({ name, description = '', code, withTextures = false }) {
  const id = `mdl_${randomUUID().slice(0, 8)}`;
  activity('model', `Generating model "${name}"...`, 'info');

  const { objects, stats } = runModelCode(code, { withTextures: !!withTextures });
  const files = saveModelFiles(id, name, { objects }, !!withTextures);
  rememberModel(id, name, { objects }, !!withTextures);

  // supersede previous pending model
  if (state.pendingModel && state.pendingModel.status === 'pending') {
    state.pendingModel.status = 'superseded';
    broadcast('model', { action: 'superseded', id: state.pendingModel.id });
  }

  const model = {
    id,
    name,
    description,
    code,
    withTextures: !!withTextures,
    status: 'pending',
    stats,
    ...files,
    createdAt: new Date().toISOString(),
  };
  state.pendingModel = model;

  broadcast('model', { action: 'generated', model });
  activity('model', `Model "${name}" ready — ${stats.objects} mesh(es), ${stats.triangles.toLocaleString()} tris. Review it in the frontend.`, 'success');

  const feedbackNote = state.lastFeedback
    ? `\n\nNOTE — the user reviewed the previous model and left this feedback: "${state.lastFeedback}". They clicked "Regenerate" or "Reject", so adjust accordingly.`
    : '';

  const editNotes = state.editRequests
    .map((er) => `- "${er.assetName}" (${er.assetId}): "${er.feedback}"`)
    .join('\n');
  const editNote = editNotes
    ? `\n\nNOTE — the user requested fixes to previously accepted assets:\n${editNotes}\nAddress this feedback in the new model.`
    : '';

  return {
    modelId: id,
    name,
    stats,
    exported: { glb: files.glbUrl, obj: files.objUrl },
    preview: 'The user can now preview this model in the local frontend. It will review and Accept/Reject/Regenerate it there.',
    resultText:
      `Model "${name}" (${id}) generated: ${stats.objects} mesh(es), ${stats.vertices.toLocaleString()} vertices, ${stats.triangles.toLocaleString()} triangles, bounds ${stats.size.x}×${stats.size.y}×${stats.size.z}.${feedbackNote}${editNote}`,
  };
}

/** Internal helper used by the API for regenerate. */
export function regenerateModel(pending) {
  return generateModel({
    name: pending.name,
    description: pending.description,
    code: pending.code,
    withTextures: pending.withTextures,
  });
}
