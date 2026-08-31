import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:7891';
const proc = spawn('node', ['index.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), stdio: 'ignore', env: { ...process.env, ROTOOLS_NO_MCP: '1', ROTOOLS_PORT: '7891' } });

async function jfetch(path, opts) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

try {
  for (let i = 0; i < 25; i++) {
    try { await fetch(BASE + '/api/state'); break; } catch { await new Promise((r) => setTimeout(r, 300)); }
  }

  // generate + accept (via MCP like an AI would)
  const client = new Client({ name: 'fix-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(BASE + '/mcp')));
  await client.callTool({
    name: 'generate_model',
    arguments: { name: 'Boulder', code: `scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 3), makeMaterial({ color: '#777' })));` },
  });
  let st = await jfetch('/api/state');
  await jfetch(`/api/models/${st.data.pendingModel.id}/accept`, { method: 'POST' });
  const assetId = (await jfetch('/api/state')).data.assets[0].id;
  console.log('1. asset accepted:', assetId);

  // request a fix from the frontend
  let r = await jfetch(`/api/assets/${assetId}/edit`, { method: 'POST', body: { feedback: 'make it smoother and greener' } });
  console.log('2. fix requested →', r.status, '|', r.data.request.feedback);

  // empty feedback rejected
  r = await jfetch(`/api/assets/${assetId}/edit`, { method: 'POST', body: { feedback: '   ' } });
  console.log('3. empty feedback rejected →', r.status === 400 ? 'YES' : 'NO');

  // AI sees the fix request in generate_model result
  const gen = await client.callTool({ name: 'generate_model', arguments: { name: 'Boulder v2', code: `scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 4), makeMaterial({ color: '#6a8a5a' })));` } });
  const seesFix = gen.content[0].text.includes('make it smoother and greener');
  console.log('4. AI sees fix in generate_model →', seesFix ? 'YES' : 'NO');

  // get_status lists it too
  const status = await client.callTool({ name: 'get_status', arguments: {} });
  console.log('5. get_status lists fix →', status.content[0].text.includes('make it smoother and greener') ? 'YES' : 'NO');

  // cancel
  r = await jfetch(`/api/assets/${assetId}/edit`, { method: 'DELETE' });
  console.log('6. cancel fix →', r.status);

  await client.close();
  console.log('\nFIX-REQUEST TESTS PASSED ✔');
} finally {
  proc.kill();
  setTimeout(() => process.exit(0), 100).unref();
}
