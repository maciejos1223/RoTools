import { spawn } from 'node:child_process';

const BASE = 'http://localhost:7890';

// start server (no MCP needed)
const proc = spawn('node', ['index.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, ROTOOLS_NO_MCP: '1' } });

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

  // 1. GET config masked
  let c = await jfetch('/api/config');
  console.log('1. GET /api/config →', c.status, '| port:', c.data.port, '| sfx.api_key:', JSON.stringify(c.data.sfx.api_key));
  if (c.data.sfx.api_key === undefined || typeof c.data.sfx.api_key === 'string') throw new Error('secrets not masked');

  // 2. POST set a key
  let r = await jfetch('/api/config', { method: 'POST', body: { sfx: { api_key: 'sk-test-1234abcd' } } });
  console.log('2. POST set key →', r.status, '| masked now:', r.data.config?.sfx?.api_key?.masked);
  if (r.data.config?.sfx?.api_key?.masked !== '••••abcd') throw new Error('key not saved/masked');

  // 3. POST with masked placeholder must NOT overwrite
  r = await jfetch('/api/config', { method: 'POST', body: { sfx: { api_key: '••••abcd' } } });
  const fs = await import('node:fs');
  const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
  console.log('   file api_key after masked POST:', JSON.stringify(raw.sfx.api_key));
  if (raw.sfx.api_key !== 'sk-test-1234abcd') throw new Error('masked value overwrote real key!');
  console.log('3. masked placeholder ignored →', r.status, '| file still has real key');

  // 4. clear key
  r = await jfetch('/api/config', { method: 'POST', body: { sfx: { api_key: '' } } });
  const raw2 = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
  if (raw2.sfx.api_key !== '') throw new Error('clear failed');
  console.log('4. clear key →', r.status, '| file cleared');

  // 5. port validation
  r = await jfetch('/api/config', { method: 'POST', body: { port: 99999 } });
  if (r.status !== 400) throw new Error('invalid port accepted!');
  console.log('5. invalid port rejected →', r.status, r.data.error);

  // 6. provider change persists
  r = await jfetch('/api/config', { method: 'POST', body: { sfx: { provider: 'google' } } });
  console.log('6. provider switch →', r.status, '| sfx.provider:', r.data.config.sfx.provider);
  // restore
  await jfetch('/api/config', { method: 'POST', body: { sfx: { provider: 'elevenlabs' } } });

  // 7. test endpoint without key
  r = await jfetch('/api/config/test', { method: 'POST', body: { section: 'sfx' } });
  console.log('7. test sfx (no key) →', r.data.ok, '|', r.data.message);

  console.log('\nCONFIG TESTS PASSED ✔');
} finally {
  proc.unref();
  setTimeout(() => process.exit(0), 100).unref();
}
