import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:7891';

// start server (HTTP only)
const proc = spawn('node', ['index.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), stdio: 'ignore', env: { ...process.env, ROTOOLS_NO_MCP: '1', ROTOOLS_PORT: '7891' } });

async function waitApi() {
  for (let i = 0; i < 25; i++) {
    try { await fetch(BASE + '/api/state'); return; } catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  throw new Error('API did not start');
}

try {
  await waitApi();
  console.log('server up');

  // connect via Streamable HTTP
  const client = new Client({ name: 'http-e2e', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(BASE + '/mcp'));
  await client.connect(transport);
  console.log('1. MCP over HTTP connected');

  const tools = await client.listTools();
  console.log('2. tools:', tools.tools.map((t) => t.name).join(', '));

  const gen = await client.callTool({
    name: 'generate_model',
    arguments: {
      name: 'HTTP Rock',
      code: `const geo = new THREE.DodecahedronGeometry(1.8, 1);
displace(geo, 0.3, 2.5, 11);
const m = new THREE.Mesh(geo, makeMaterial({ color: '#8a7f70', roughness: 1 }));
scene.add(m);`,
    },
  });
  console.log('3. generate_model over HTTP →', gen.content[0].text.split('\n')[0]);

  const status = await client.callTool({ name: 'get_status', arguments: {} });
  console.log('4. get_status →', status.content[0].text.split('\n')[0]);

  await client.close();
  console.log('\nHTTP MCP TESTS PASSED ✔');
} finally {
  proc.kill();
  setTimeout(() => process.exit(0), 100).unref();
}
