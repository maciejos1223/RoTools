import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:7890';

async function jfetch(path, opts) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// 1. spawn server (with MCP stdio)
const transport = new StdioClientTransport({
  command: 'node',
  args: ['index.js'],
  cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\\/g, '/'),
  stderr: 'inherit',
});
const client = new Client({ name: 'e2e-test', version: '1.0.0' });
await client.connect(transport);
console.log('1. MCP client connected');

// 2. list tools
const tools = await client.listTools();
const names = tools.tools.map((t) => t.name);
console.log('2. tools:', names.join(', '));
if (!names.includes('generate_model') || !names.includes('export_model') || !names.includes('generate_sfx') || !names.includes('import_to_roblox')) {
  throw new Error('missing tools');
}

// 3. wait for HTTP API
for (let i = 0; i < 20; i++) {
  try { await fetch(BASE + '/api/state'); break; } catch { await new Promise((r) => setTimeout(r, 300)); }
}
console.log('3. HTTP API is up');

// 4. generate a model via MCP
const gen = await client.callTool({
  name: 'generate_model',
  arguments: {
    name: 'E2E Rock',
    code: `const geo = new THREE.IcosahedronGeometry(2, 4);
displace(geo, 0.6, 1.5, 42);
const m = new THREE.Mesh(geo, makeMaterial({ color: '#777', roughness: 1, texture: { type: 'noise', colors: ['#888', '#555'], scale: 5 } }));
m.name = 'Rock'; scene.add(m);`,
    withTextures: true,
  },
});
console.log('4. generate_model →', gen.content[0].text.split('\n')[0]);

// 5. frontend state has pending model
const st = await jfetch('/api/state');
if (!st.data.pendingModel || st.data.pendingModel.name !== 'E2E Rock') throw new Error('no pending model in state');
const glbRes = await fetch(BASE + st.data.pendingModel.glbUrl);
console.log('5. pending model in state, GLB size:', glbRes.headers.get('content-length'), 'bytes');

// 6. accept via API (frontend action)
const acc = await jfetch(`/api/models/${st.data.pendingModel.id}/accept`, { method: 'POST' });
console.log('6. accepted → asset', acc.data.asset.id);

// 7. queue import (frontend button) and simulate the Roblox plugin
const imp = await jfetch(`/api/assets/${acc.data.asset.id}/import`, { method: 'POST' });
console.log('7. import queued:', imp.data.jobId);
const next = await jfetch('/roblox/next?version=test');
if (!next.data.jobId) throw new Error('plugin poll returned no job');
const payload = JSON.parse(next.data.payload);
console.log('7. plugin picked up job — objects:', payload.objects.length, 'verts obj0:', payload.objects[0].positions.length / 3);
const res2 = await jfetch('/roblox/result', {
  method: 'POST',
  body: { jobId: next.data.jobId, ok: true, assetName: 'E2E_Rock_Model', parts: payload.objects.length },
});
console.log('7. plugin reported result:', res2.status);

// 8. export via MCP
const exp = await client.callTool({ name: 'export_model', arguments: { format: 'gltf' } });
console.log('8. export_model →', exp.content[0].text);

// 9. status tool
const status = await client.callTool({ name: 'get_status', arguments: {} });
console.log('9. get_status →', status.content[0].text.split('\n').slice(0, 2).join(' | '));

await client.close();
console.log('\nE2E TESTS PASSED ✔');
process.exit(0);
