import { randomUUID } from 'node:crypto';

export const state = {
  startedAt: Date.now(),
  clients: 0,
  roblox: { online: false, lastSeen: null, studioVersion: null },
  pendingModel: null,
  assets: [],
  sfx: [],
  imports: [],
  activity: [],
  lastFeedback: null,
  sseClients: new Set(),
};

export function activity(type, message, level = 'info') {
  const entry = { id: randomUUID(), type, message, level, at: new Date().toISOString() };
  state.activity.push(entry);
  if (state.activity.length > 300) state.activity.splice(0, state.activity.length - 300);
  broadcast('activity', entry);
  console.log(`[${level}] ${type}: ${message}`);
  return entry;
}

export function broadcast(type, payload) {
  const data = `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
  for (const res of state.sseClients) {
    if (res.destroyed || res.writableEnded) {
      state.sseClients.delete(res);
      continue;
    }
    try { res.write(data); } catch { state.sseClients.delete(res); }
  }
}

export function publicState() {
  return {
    startedAt: state.startedAt,
    clients: state.clients,
    roblox: state.roblox,
    pendingModel: state.pendingModel,
    assets: state.assets,
    sfx: state.sfx,
    imports: state.imports.slice(-20),
    activity: state.activity.slice(-100),
  };
}
