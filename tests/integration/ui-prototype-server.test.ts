import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { request } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { allRoutePaths } from '../../ui/prototype/src/journey-model.js';

const script = fileURLToPath(new URL('../../../scripts/serve-ui-prototype.mjs', import.meta.url));
// Source modules decide which scripts the page needs; `npm test` runs build:ui first so each has compiled output.
const uiSourceDir = new URL('../../../ui/prototype/src/', import.meta.url);
const uiOutputDir = new URL('../../ui-prototype/', import.meta.url);

function scriptNames(dir: URL, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension) && !entry.name.endsWith('.d.ts'))
    .map((entry) => entry.name.slice(0, -extension.length))
    .sort();
}

interface Reply { status: number; headers: Record<string, string | string[] | undefined>; body: string }

function start(): Promise<{ child: ChildProcessWithoutNullStreams; host: string; port: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--port', '0'], { shell: false, stdio: 'pipe' });
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('server did not start')); }, 15_000);
    child.stdout.on('data', (chunk) => {
      out += String(chunk);
      const match = /http:\/\/([\d.]+):(\d+)\//.exec(out);
      if (match?.[1] && match[2]) { clearTimeout(timer); resolve({ child, host: match[1], port: Number(match[2]) }); }
    });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

function send(port: number, path: string, options: { method?: string; host?: string } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: options.method ?? 'GET', headers: { host: options.host ?? `127.0.0.1:${port}` } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += String(chunk); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.once('error', reject);
    req.end();
  });
}

test('prototype server binds loopback only, serves the allowlist with strict headers and refuses everything else', async (t) => {
  const { child, host, port } = await start();
  t.after(() => { child.kill(); });
  assert.equal(host, '127.0.0.1');

  const page = await send(port, '/');
  assert.equal(page.status, 200);
  assert.match(String(page.headers['content-type']), /^text\/html/);
  assert.match(page.body, /Practice example/);
  const csp = String(page.headers['content-security-policy']);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');

  for (const path of allRoutePaths()) {
    const screen = await send(port, path);
    assert.equal(screen.status, 200, path);
    assert.equal(screen.body, page.body, `${path} serves the same page`);
  }
  assert.equal((await send(port, '/styles.css')).status, 200);

  const sourceModules = scriptNames(uiSourceDir, '.ts');
  assert.ok(sourceModules.includes('main'), 'prototype sources include main.ts');
  const compiledModules = scriptNames(uiOutputDir, '.js');
  for (const name of sourceModules) {
    assert.ok(compiledModules.includes(name), `${name}.js is compiled; run npm run build:ui`);
  }
  for (const name of compiledModules) {
    const app = await send(port, `/app/${name}.js`);
    assert.equal(app.status, 200, `/app/${name}.js`);
    assert.match(String(app.headers['content-type']), /^text\/javascript/, `/app/${name}.js`);
  }
  const head = await send(port, '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');

  for (const path of ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json', '/ui/prototype/src/fixtures.ts', '/app/../../package.json', '/scripts/serve-ui-prototype.mjs', '/app/secret.js', '/index.html/']) {
    assert.equal((await send(port, path)).status, 404, path);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const reply = await send(port, '/', { method });
    assert.equal(reply.status, 405, method);
    assert.equal(reply.headers.allow, 'GET, HEAD');
  }
  assert.equal((await send(port, '/', { host: `attacker.example:${port}` })).status, 421);
});
