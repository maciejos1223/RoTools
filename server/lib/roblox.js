import { randomUUID } from 'node:crypto';
import { activity, broadcast, state } from './state.js';

const jobs = new Map(); // id -> { job, resolve, reject, timer }

/** Queue a mesh import job and wait for the Roblox Studio plugin to consume it. */
export function queueImport({ name, model, assetId = null, timeoutMs = 120_000 }) {
  const id = `imp_${randomUUID().slice(0, 8)}`;
  const payload = buildPluginPayload(name, model);
  const job = {
    id,
    assetId,
    name,
    status: 'queued',
    createdAt: new Date().toISOString(),
    size: payload.length,
  };
  state.imports.push(job);

  const promise = new Promise((resolve, reject) => {
    jobs.set(id, { job, payload, resolve, reject });
    const timer = setTimeout(() => {
      if (jobs.has(id)) {
        job.status = 'timeout';
        jobs.get(id).reject(new Error('Roblox Studio plugin did not pick up the import (is Studio open with the plugin installed and running?)'));
        jobs.delete(id);
        broadcast('import', { action: 'timeout', job });
        activity('roblox', `Import "${name}" timed out — plugin not responding`, 'error');
      }
    }, timeoutMs);
    timer.unref?.();
  });

  activity('roblox', `Import queued for "${name}" (${(payload.length / 1024).toFixed(0)} KB mesh data)`, 'info');
  broadcast('import', { action: 'queued', job });
  return { id, promise, job };
}

function buildPluginPayload(name, model) {
  const objects = model.objects.map((o) => ({
    name: o.name,
    positions: Array.from(o.positions, (v) => +v.toFixed(4)),
    indices: Array.from(o.indices),
    color: o.material.color,
    metalness: o.material.metalness ?? 0.1,
    roughness: o.material.roughness ?? 0.85,
  }));
  return JSON.stringify({
    version: 1,
    name,
    objects,
  });
}

/** Called by GET /roblox/next — hand next queued job to the plugin. */
export function takeJob(studioVersion = null) {
  const entry = [...jobs.values()].find((e) => e.job.status === 'queued');
  const now = Date.now();
  const wasOnline = state.roblox.online;
  state.roblox.online = true;
  state.roblox.lastSeen = now;
  state.roblox.studioVersion = studioVersion || state.roblox.studioVersion;
  if (!wasOnline) {
    broadcast('roblox', { online: true });
    activity('roblox', 'Roblox Studio plugin connected', 'success');
  }
  if (!entry) return null;
  entry.job.status = 'dispatched';
  entry.dispatchedAt = now;
  broadcast('import', { action: 'dispatched', job: entry.job });
  activity('roblox', `Studio importing "${entry.job.name}"...`, 'info');
  return { jobId: entry.job.id, payload: entry.payload };
}

/** Called by POST /roblox/result — plugin reports outcome. */
export function completeJob({ jobId, ok, assetName = null, error = null, parts = 0 }) {
  const entry = jobs.get(jobId);
  if (!entry) return { ok: false, error: 'unknown job' };
  jobs.delete(jobId);
  clearTimeout(entry.timer);
  entry.job.status = ok ? 'imported' : 'failed';
  entry.job.error = error;
  entry.job.parts = parts;
  entry.job.finishedAt = new Date().toISOString();
  entry.job.assetName = assetName;
  if (ok) {
    entry.resolve({ assetName, parts, jobId });
    activity('roblox', `Imported "${entry.job.name}" into Studio as "${assetName}" (${parts} part(s))`, 'success');
  } else {
    entry.reject(new Error(`Roblox import failed: ${error}`));
    activity('roblox', `Import of "${entry.job.name}" failed: ${error}`, 'error');
  }
  broadcast('import', { action: entry.job.status, job: entry.job });
  return { ok: true };
}
