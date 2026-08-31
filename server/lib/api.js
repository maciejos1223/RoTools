import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadConfig, outputDir, maskConfig, saveConfigPatch } from '../config.js';
import { activity, broadcast, publicState, state } from './state.js';
import { queueImport, takeJob, completeJob } from './roblox.js';
import { getModel } from './modelStore.js';
import { generateModel, regenerateModel } from '../tools/generateModel.js';
import { generateSfx } from './sfx.js';
import { createMcpServer } from '../mcpServer.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApi() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  /* ---------- SSE ---------- */
  app.get('/api/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write(`event: hello\ndata: ${JSON.stringify({ type: 'hello' })}\n\n`);
    state.sseClients.add(res);
    req.on('close', () => state.sseClients.delete(res));
  });

  /* ---------- MCP over HTTP (any client: Cursor, opencode, Claude Code, …) ---------- */
  const httpTransports = new Map();
  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId) {
        // new session (initialize) — SDK assigns the session id
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (id) => httpTransports.set(id, transport),
        });
        transport.onclose = () => {
          if (transport.sessionId) httpTransports.delete(transport.sessionId);
        };
        const server = createMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }
      const transport = httpTransports.get(sessionId);
      if (!transport) {
        return res.status(404).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: null });
      }
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP HTTP error:', err);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message }, id: null });
    }
  });

  /* ---------- state ---------- */
  app.get('/api/state', (_req, res) => res.json(publicState()));

  /* ---------- settings ---------- */
  app.get('/api/config', (_req, res) => res.json(maskConfig()));

  app.post('/api/config', (req, res) => {
    try {
      const patch = req.body || {};
      // guard: never accept masked placeholder values as real keys
      for (const section of ['sfx', 'music']) {
        if (patch[section]) {
          for (const key of ['api_key', 'google_api_key']) {
            if (typeof patch[section][key] === 'string' && patch[section][key].startsWith('•')) {
              delete patch[section][key];
            }
          }
        }
      }
      saveConfigPatch(patch);
      activity('server', 'Settings updated via frontend', 'info');
      res.json({ ok: true, config: maskConfig() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/config/test', async (req, res) => {
    const cfg = loadConfig();
    const section = req.body?.section;
    try {
      if (section === 'sfx') {
        const key = cfg.sfx.provider === 'google'
          ? cfg.sfx.google_api_key || cfg.sfx.api_key || process.env.GEMINI_API_KEY
          : cfg.sfx.api_key || process.env.ELEVENLABS_API_KEY;
        if (!key) return res.json({ ok: false, message: 'No API key set' });
        if (cfg.sfx.provider === 'google') {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1`, { headers: { 'x-goog-api-key': key } });
          return res.json(r.ok ? { ok: true, message: 'Google API key works' } : { ok: false, message: `Google API error ${r.status}` });
        }
        if (cfg.sfx.provider === 'elevenlabs') {
          const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': key } });
          return res.json(r.ok ? { ok: true, message: 'ElevenLabs key works' } : { ok: false, message: `ElevenLabs error ${r.status}` });
        }
        return res.json({ ok: false, message: 'No test available for custom provider' });
      }
      if (section === 'music') {
        const key = cfg.music.api_key || cfg.sfx.google_api_key || process.env.GEMINI_API_KEY;
        if (!key) return res.json({ ok: false, message: 'No Google API key set' });
        if (cfg.music.provider === 'custom') return res.json({ ok: false, message: 'No test available for custom provider' });
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.music.model)}?`, { headers: { 'x-goog-api-key': key } });
        return res.json(r.ok ? { ok: true, message: `Key works, model "${cfg.music.model}" reachable` } : { ok: false, message: `Google API error ${r.status} (model ${cfg.music.model})` });
      }
      res.status(400).json({ error: 'section must be "sfx" or "music"' });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });

  /* ---------- pending model actions ---------- */
  app.post('/api/models/:id/accept', (req, res) => {
    const m = state.pendingModel;
    if (!m || m.id !== req.params.id) return res.status(404).json({ error: 'Model not found or not pending' });
    m.status = 'accepted';
    const asset = {
      id: `AST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: req.body?.name || m.name,
      modelId: m.id,
      glbUrl: m.glbUrl,
      objUrl: m.objUrl,
      imported: false,
      createdAt: new Date().toISOString(),
    };
    state.assets.unshift(asset);
    state.lastFeedback = null;
    broadcast('asset', { action: 'created', asset });
    activity('model', `Accepted "${m.name}" → asset ${asset.id}`, 'success');
    res.json({ ok: true, asset });
  });

  app.post('/api/models/:id/reject', (req, res) => {
    const m = state.pendingModel;
    if (!m || m.id !== req.params.id) return res.status(404).json({ error: 'Model not found or not pending' });
    m.status = 'rejected';
    m.feedback = req.body?.feedback || 'Rejected without comment';
    state.lastFeedback = m.feedback;
    broadcast('model', { action: 'status', id: m.id, status: 'rejected' });
    activity('model', `Rejected "${m.name}"${m.feedback ? ` — "${m.feedback}"` : ''}`, 'warn');
    res.json({ ok: true });
  });

  app.post('/api/models/:id/regenerate', async (req, res) => {
    const m = state.pendingModel;
    if (!m || m.id !== req.params.id) return res.status(404).json({ error: 'Model not found or not pending' });
    const feedback = req.body?.feedback || null;
    if (feedback) state.lastFeedback = feedback;
    activity('model', `Regenerating "${m.name}"${feedback ? ` — "${feedback}"` : ''}...`, 'info');
    try {
      await regenerateModel(m);
      res.json({ ok: true });
    } catch (err) {
      activity('model', `Regeneration failed: ${err.message}`, 'error');
      res.status(500).json({ error: err.message });
    }
  });

  /* ---------- file serving ---------- */
  const serveModelFile = (kind, ext) => (req, res) => {
    const id = req.params.id;
    const model = getModel(id) || (state.pendingModel?.id === id ? { name: state.pendingModel.name, modelData: null } : null);
    const file = path.join(outputDir(), 'models', `${id}.${ext}`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found' });
    res.set('Content-Type', ext === 'glb' ? 'model/gltf-binary' : 'text/plain');
    if (kind === 'download') res.set('Content-Disposition', `attachment; filename="${id}.${ext}"`);
    fs.createReadStream(file).pipe(res);
  };
  app.get('/api/models/:id/file.glb', serveModelFile('view', 'glb'));
  app.get('/api/models/:id/file.obj', serveModelFile('view', 'obj'));

  /* ---------- assets ---------- */
  app.post('/api/assets/:id/import', async (req, res) => {
    const asset = state.assets.find((a) => a.id === req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const stored = getModel(asset.modelId);
    if (!stored) return res.status(410).json({ error: 'Model data not in memory — regenerate the model' });
    try {
      const { job, promise } = queueImport({ name: asset.name, model: stored.modelData, assetId: asset.id });
      promise
        .then((result) => {
          asset.imported = true;
          asset.robloxRef = result.assetName;
          asset.parts = result.parts;
          asset.importedAt = new Date().toISOString();
        })
        .catch(() => {});
      res.json({ ok: true, jobId: job.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ---------- sfx ---------- */
  app.post('/api/sfx', async (req, res) => {
    try {
      const { prompt, duration, name, kind } = req.body || {};
      if (!prompt) return res.status(400).json({ error: 'prompt required' });
      const record = await generateSfx({ prompt, duration, name, kind });
      if (!state.sfx.find((s) => s.id === record.id)) state.sfx.unshift(record);
      res.json({ ok: true, sfx: record });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get('/api/sfx/:id/file', (req, res) => {
    const sfx = state.sfx.find((s) => s.id === req.params.id);
    if (!sfx || !fs.existsSync(sfx.file)) return res.status(404).json({ error: 'Not found' });
    res.set('Content-Type', sfx.format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    fs.createReadStream(sfx.file).pipe(res);
  });

  /* ---------- roblox plugin endpoints ---------- */
  app.get('/roblox/next', (req, res) => {
    const version = req.query.version ? String(req.query.version) : null;
    const job = takeJob(version);
    res.json({ jobId: job?.jobId ?? null, payload: job?.payload ?? null });
  });

  app.post('/roblox/result', (req, res) => {
    const { jobId, ok, assetName, error, parts } = req.body || {};
    completeJob({ jobId, ok: !!ok, assetName, error, parts: parts || 0 });
    res.json({ ok: true });
  });

  app.post('/roblox/ping', (req, res) => {
    const wasOnline = state.roblox.online;
    state.roblox.online = true;
    state.roblox.lastSeen = Date.now();
    if (req.body?.studioVersion) state.roblox.studioVersion = req.body.studioVersion;
    if (!wasOnline) {
      broadcast('roblox', { online: true });
      activity('roblox', 'Roblox Studio plugin connected', 'success');
    }
    res.json({ ok: true, serverVersion: '1.0.0' });
  });

  /* ---------- static frontend (production) ---------- */
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|roblox).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });

  return app;
}

export function startApi() {
  const cfg = loadConfig();
  const app = createApi();
  return new Promise((resolve) => {
    const server = app.listen(cfg.port, () => {
      console.log(`  RoTools MCP HTTP API listening on http://localhost:${cfg.port}`);
      resolve(server);
    });
  });
}
