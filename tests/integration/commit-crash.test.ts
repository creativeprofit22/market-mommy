import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { SqliteStorage } from '../../src/adapters/sqlite/client.js';
import * as f from '../helpers/records.js';
import type { WorkflowRequest } from '../../src/application/workflow.js';
import type { FixtureResult } from '../../src/domain/fixture-result.js';

async function killAtCommit(path: string, operation: string, edge: string, request: object) {
  const child = fork(new URL('../helpers/commit-crash.js', import.meta.url), [path, operation, edge, JSON.stringify(request)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const closed = once(child, 'close');
  let diagnostics = '';
  child.stderr!.on('data', chunk => { diagnostics += String(chunk); });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const [marker] = await Promise.race([
      once(child, 'message', { signal: controller.signal }),
      closed.then(() => { throw new Error(`Child exited before pause: ${diagnostics}`); }),
    ]);
    assert.deepEqual(marker, { state: 'paused', operation, edge });
    assert.equal(child.kill('SIGKILL'), true);
    await closed;
  } finally {
    clearTimeout(timer); controller.abort();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  }
}
function rows(path: string, table: string) {
  const db = new DatabaseSync(path);
  try { return db.prepare(`SELECT * FROM ${table}`).all().map(row => ({ ...row })); } finally { db.close(); }
}
for (const operation of ['intent', 'result']) for (const edge of ['before', 'after']) {
  test(`SIGKILL ${edge} ${operation} COMMIT preserves atomic real-path replay`, { timeout: 20000 }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'market-mommy-commit-crash-'));
    const path = join(root, 'store.sqlite');
    let store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
    t.after(async () => { await store.close(); await rm(root, { recursive: true, force: true }); });
    for (const command of [
      { action: 'saveProfile', requestId: 'profile', profileId: 'P', expectedVersion: 0, profile: f.profile },
      { action: 'createJourney', requestId: 'journey', journeyId: 'J', profileId: 'P', profileVersion: 1, expectedVersion: 0, priorLearning: [] },
    ]) assert.equal((await store.dispatch(JSON.stringify(command))).status, 'ok');
    const intent = { action: 'enqueueJob', requestId: 'intent', journeyId: 'J', expectedVersion: 1, limits: f.limits };
    const output: FixtureResult = { scope: 'synthetic-fixture', label: 'Deterministic synthetic fixture; not market research.', evidence: [] };
    let settlement: WorkflowRequest | undefined;
    let running;
    if (operation === 'result') {
      assert.equal((await store.dispatch(JSON.stringify(intent))).status, 'ok');
      [running] = await store.workflow({ action: 'claim', ownerId: 'crash-owner', leaseMs: 120000 });
      assert.ok(running);
      settlement = { action: 'settle', jobId: running.id, journeyId: 'J', ownerId: 'crash-owner', fence: running.fence, state: 'succeeded', actualMinorUnits: 0, providerRequestId: null, validatedResult: output };
    }
    const beforeJourney = await store.read('J');
    const beforeLedger = rows(path, 'workflow_ledger');
    await store.close();
    await killAtCommit(path, operation, edge, settlement ?? intent);
    store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
    if (operation === 'intent') {
      assert.equal(rows(path, 'workflow_attempts').length, edge === 'before' ? 0 : 1);
      if (edge === 'before') {
        assert.deepEqual(await store.read('J'), beforeJourney);
        assert.deepEqual(rows(path, 'workflow_ledger'), beforeLedger);
        assert.equal(rows(path, 'request_receipts').some(row => row.request_id === 'intent'), false);
      }
      const committed = rows(path, 'request_receipts').find(row => row.request_id === 'intent');
      const replay = await store.dispatch(JSON.stringify(intent)); assert.equal(replay.status, 'ok');
      if (committed) assert.deepEqual(replay, JSON.parse(String(committed.result)));
      assert.deepEqual(await store.dispatch(JSON.stringify(intent)), replay);
      assert.equal(rows(path, 'workflow_attempts').length, 1);
      assert.equal(rows(path, 'workflow_ledger').length, 1);
      assert.equal(rows(path, 'request_receipts').filter(row => row.request_id === 'intent').length, 1);
    } else {
      assert.ok(running); assert.ok(settlement);
      assert.equal(rows(path, 'workflow_results').length, edge === 'before' ? 0 : 1);
      assert.equal(rows(path, 'workflow_receipts').length, edge === 'before' ? 0 : 1);
      if (edge === 'before') {
        assert.deepEqual((await store.read(running.id))?.data, running);
        assert.deepEqual(await store.read('J'), beforeJourney);
        assert.deepEqual(rows(path, 'workflow_ledger'), beforeLedger);
        assert.equal(rows(path, 'workflow_claim')[0]?.job_id, running.id);
      }
      const committed = rows(path, 'workflow_receipts')[0];
      const replay = await store.workflow(settlement);
      if (committed) assert.deepEqual(replay, JSON.parse(String(committed.result)));
      assert.equal(replay[0]?.state, 'succeeded');
      const ledger = rows(path, 'workflow_ledger');
      assert.deepEqual(await store.workflow(settlement), replay);
      assert.deepEqual(rows(path, 'workflow_ledger'), ledger);
      assert.equal(ledger.length, beforeLedger.length + 1);
      assert.equal(rows(path, 'workflow_receipts').length, 1);
      const results = rows(path, 'workflow_results'); assert.equal(results.length, 1);
      assert.deepEqual(JSON.parse(String(results[0]?.result)), output);
      assert.equal(rows(path, 'workflow_claim')[0]?.job_id, null);
    }
  });
}
