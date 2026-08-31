import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:7891';
const proc = spawn('node', ['index.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ROTOOLS_NO_MCP: '1', ROTOOLS_PORT: '7891' } });

async function jfetch(path, opts) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function waitApi() {
  for (let i = 0; i < 25; i++) {
    try { await fetch(BASE + '/api/state'); return; } catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  throw new Error('API did not start');
}

try {
  await waitApi();
  console.log('server up');

  // 1. keep an SSE connection open (like the frontend does)
  const sse = await fetch(BASE + '/api/events');
  console.log('1. SSE open:', sse.status);

  // 2. connect MCP over HTTP and generate
  const client = new Client({ name: 'crash-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(BASE + '/mcp')));
  const gen = await client.callTool({
    name: 'generate_model',
    arguments: {
      name: 'Crash Rock',
      code: `const g = new THREE.IcosahedronGeometry(1.5, 3); displace(g, 0.4, 2, 3);
scene.add(new THREE.Mesh(g, makeMaterial({ color: '#777', texture: { type: 'noise', colors: ['#888','#555'], scale: 5 } })));`,
      withTextures: true,
    },
  });
  console.log('2. generated:', gen.content[0].text.split('\n')[0]);
  await client.close();
  console.log('3. MCP session closed');

  // abort the SSE socket mid-stream (simulate proxy reset) then trigger events
  sse.body.cancel().catch(() => {});

  // 4. regenerate with NO feedback (the reported crash path)
  const st = await jfetch('/api/state');
  let r = await jfetch(`/api/models/${st.data.pendingModel.id}/regenerate`, { method: 'POST', body: {} });
  console.log('4. regenerate (no feedback) →', r.status);
  r = await jfetch(`/api/models/${st.data.pendingModel.id}/regenerate`, { method: 'POST', body: {} });
  console.log('5. regenerate again →', r.status);

  // 5. reject + accept still work
  const st2 = await jfetch('/api/state');
  r = await jfetch(`/api/models/${st2.data.pendingModel.id}/reject`, { method: 'POST', body: { feedback: 'too pointy' } });
  console.log('6. reject →', r.status);
  r = await jfetch(`/api/models/${st2.data.pendingModel.id}/regenerate`, { method: 'POST', body: { feedback: 'more organic' } });
  console.log('7. regenerate with feedback →', r.status);
  const st3 = await jfetch('/api/state');
  r = await jfetch(`/api/models/${st3.data.pendingModel.id}/accept`, { method: 'POST' });
  console.log('8. accept →', r.status);

  // 6. server must still be alive
  const alive = await fetch(BASE + '/api/state');
  console.log('9. server still alive:', alive.status === 200 ? 'YES' : 'NO');
  if (alive.status !== 200) throw new Error('SERVER DIED');

  console.log('\nCRASH-RESILIENCE TESTS PASSED ✔');
} finally {
  proc.kill();
  setTimeout(() => process.exit(0), 100).unref();
}
