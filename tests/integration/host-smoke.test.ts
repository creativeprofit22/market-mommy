import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { DispatchResult } from '../../src/application/dispatch.js';
import { cli } from '../helpers/interfaces.js';
import * as f from '../helpers/records.js';

const script = fileURLToPath(new URL('../../../scripts/prepare-host-smoke.mjs', import.meta.url));

function prepare(dir: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--dir', dir], { shell: false, stdio: 'pipe', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('prepare-host-smoke exceeded deadline')); }, 60_000);
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
  });
}
const sha256 = async (path: string): Promise<string> => createHash('sha256').update(await readFile(path)).digest('hex');

test('host smoke preparation script writes a store whose read-only CLI result matches the expected resume, and refuses overwrite', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'market-mommy-host-smoke-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = join(dir, 'fixtures.sqlite');
  const expectedPath = join(dir, 'expected-resume.json');

  const run = await prepare(dir);
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.stderr, '');
  assert.ok(existsSync(store));
  assert.ok(existsSync(expectedPath));
  const hash = await sha256(store);
  assert.ok(run.stdout.includes(hash));
  assert.ok(run.stdout.includes('"--capabilities",\n        "read"'));

  const expected = JSON.parse(await readFile(expectedPath, 'utf8')) as DispatchResult;
  assert.equal(expected.status, 'ok');
  assert.deepEqual(await cli(store, dir, { action: 'resumeJourney', journeyId: 'HOST-J' }, false), expected);
  const write = await cli(store, dir, { action: 'saveProfile', requestId: 'host-write', profileId: 'HOST-X', expectedVersion: 0, profile: f.profile }, false);
  assert.equal(write.status, 'error');
  if (write.status === 'error') assert.equal(write.error.code, 'unauthorized');
  assert.equal(await sha256(store), hash);

  const again = await prepare(dir);
  assert.equal(again.code, 1);
  assert.match(again.stderr, /refusing to overwrite/);
  assert.equal(await sha256(store), hash);
  assert.deepEqual(JSON.parse(await readFile(expectedPath, 'utf8')), expected);
});
