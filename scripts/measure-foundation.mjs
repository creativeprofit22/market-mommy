// Synthetic foundation measurements only. Run after build with the pinned Node and --expose-gc.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir, cpus, totalmem, release } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SqliteStorage } from '../dist/src/adapters/sqlite/client.js';
import { runNextFixture } from '../dist/src/adapters/ggframework/runner.js';
import * as fixture from '../dist/tests/helpers/records.js';

const report = {
  schema: 1, scope: 'synthetic-foundation-only', startedAt: new Date().toISOString(),
  host: { node: process.versions.node, platform: process.platform, osRelease: release(), arch: process.arch,
    cpu: cpus()[0]?.model ?? 'unknown', logicalCpus: cpus().length, ramBytes: totalmem() },
  source: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTree: 'May include uncommitted foundation changes; this is not a release benchmark.' },
  protocol: { attemptsPerGroup: 30, percentile: 'nearest rank ceil(0.95 * 30) = 29', thresholdMs: 1000,
    failureSerialization: 'Infinity is the JSON string "Infinity"; missing/unattempted values are null with status missing and count as Infinity.',
    cold: 'New actual CLI subprocess per attempt: before spawn through parsed usable response and child close, including startup/storage loading/teardown.',
    warm: 'Persistent actual MCP SDK client/server: before callTool through parsed usable response; handshake excluded. Server/storage remain loaded; no explicit result cache.',
    differences: 'Cold CLI and warm MCP have different transport overhead. OS file caches are uncontrolled, not cleared. No provider call in retrieval. Queue/provider/persistence components are not separately instrumented.',
    workload: 'One profile/Journey; two synthetic source datasets and 50 evidence/observation pairs. Zero direction options/experiments (within maxima); advice/experiment product performance is not measured.',
    resources: 'Parent RSS and heapUsed after explicit GC and one event-loop turn; active libuv resource counts, not OS handle counts. Child peak RSS/OS handles unmeasured. Five new job/attempt/accounting records intentionally grow the store. No blanket memory-leak claim.' },
  cold: [], warm: [], cycles: [], failures: [],
};
const failure = label => { report.failures.push(label); process.exitCode = 1; };
const script = kind => fileURLToPath(new URL(`../dist/src/interfaces/${kind}.js`, import.meta.url));
const env = { NODE_NO_WARNINGS: '1' };
function own(child, deadlineMs = 12000) {
  let text = '', bytes = 0, fault = false;
  const timer = setTimeout(() => { fault = true; child.kill('SIGKILL'); }, deadlineMs);
  child.stdout?.on('data', chunk => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) { fault = true; child.kill('SIGKILL'); } else text += chunk; });
  child.stderr?.on('data', chunk => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) { fault = true; child.kill('SIGKILL'); } });
  child.stdin?.on('error', () => {});
  child.on('error', () => { fault = true; });
  const closed = new Promise(resolve => child.once('close', () => { clearTimeout(timer); resolve(); }));
  return { closed, result() { if (fault || child.exitCode !== 0) throw new Error('child-failed'); return text; },
    async stop() { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await closed; } };
}
async function cli(path) {
  const child = spawn(process.execPath, [script('cli'), '--store', path], { env, shell: false, stdio: 'pipe' });
  const owned = own(child);
  try { child.stdin.end(JSON.stringify({ action: 'resumeJourney', journeyId: 'J' })); await owned.closed; return JSON.parse(owned.result()); }
  finally { await owned.stop(); }
}
function usable(result) {
  if (result?.status !== 'ok' || !result.data?.records?.some(r => r.kind === 'journey' && r.data.id === 'J' && r.data.workload.evidenceIds.length === 50)
    || !result.data?.records?.some(r => r.kind === 'profile' && r.data.id === 'P')) throw new Error('unusable-result');
}
async function attempt(group, i, work) {
  const startedAt = new Date().toISOString(), start = performance.now();
  try { usable(await work()); group.push({ attempt: i + 1, startedAt, endedAt: new Date().toISOString(), elapsedMs: performance.now() - start, status: 'usable' }); }
  catch { group.push({ attempt: i + 1, startedAt, endedAt: new Date().toISOString(), elapsedMs: performance.now() - start, status: 'failed', completionMs: 'Infinity' }); failure(`${group === report.cold ? 'cold' : 'warm'}-${i + 1}`); }
}
async function snapshot() {
  await delay(0); globalThis.gc();
  const { rss, heapUsed } = process.memoryUsage();
  const resources = process.getActiveResourcesInfo();
  return { rssBytes: rss, heapUsedBytes: heapUsed, activeResourceCount: resources.length,
    activeResources: Object.fromEntries([...new Set(resources)].sort().map(k => [k, resources.filter(r => r === k).length])) };
}
async function bytes(path) { try { return (await stat(path)).size; } catch (e) { if (e.code === 'ENOENT') return 0; throw e; } }
let root, store, client, transport, mcpOwned;
try {
  if (process.versions.node !== '24.21.0' || !globalThis.gc) throw new Error('pinned-runtime-and-expose-gc-required');
  root = await mkdtemp(join(tmpdir(), 'market-mommy-measurement-'));
  const path = join(root, 'fixture.sqlite');
  store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
  let sequence = 0;
  const command = async value => {
    const result = await store.dispatch(JSON.stringify({ requestId: `measurement-${++sequence}`, ...value }));
    if (result.status !== 'ok') throw new Error(`dispatch-${value.action}-${result.error?.code ?? 'failed'}`);
    return result;
  };
  const journey = async () => (await store.read('J')).data;
  await command({ action: 'saveProfile', profileId: 'P', expectedVersion: 0, profile: fixture.profile });
  await command({ action: 'createJourney', journeyId: 'J', profileId: 'P', profileVersion: 1, expectedVersion: 0, priorLearning: [] });
  for (let i = 0; i < 50; i++) await command({ action: 'acceptFixtureEvidence', journeyId: 'J', expectedVersion: (await journey()).version,
    expectedObservationVersion: 0, expectedEvidenceVersion: 0, observationId: `O${i}`, evidenceId: `E${i}`,
    observation: { ...fixture.observation, sourceId: `source-${i % 2}`, originId: `origin-${i}` },
    evidence: { ...fixture.evidence, observation: { id: `O${i}`, version: 1 }, independentOrigin: `origin-${i}`, duplicateGroup: `group-${i}` } });
  report.database = { ...(await store.info()), mainBytes: await bytes(path), walBytes: await bytes(`${path}-wal`), boundary: 'After population, writer open; before retrieval and resource jobs.' };
  const versionBefore = (await journey()).version;
  for (let i = 0; i < 30; i++) await attempt(report.cold, i, () => cli(path));
  transport = new StdioClientTransport({ command: process.execPath, args: [script('mcp'), '--store', path], env, stderr: 'pipe', maxBufferSize: 2 * 1024 * 1024 });
  client = new Client({ name: 'foundation-measurement', version: '1' });
  let connected = false;
  try {
    const connecting = client.connect(transport);
    // Pinned SDK has no public child-close promise; capture only this transport's exact owned child.
    if (transport._process) mcpOwned = own(transport._process, 60000);
    await connecting; connected = true;
  } catch { failure('mcp-connect'); }
  for (let i = 0; i < 30; i++) await attempt(report.warm, i, async () => {
    if (!connected) throw new Error('not-connected');
    const response = await client.callTool({ name: 'resumeJourney', arguments: { journeyId: 'J' } }, undefined, { timeout: 12000 });
    if (response.isError || response.content?.length !== 1 || response.content[0].type !== 'text') throw new Error('mcp-envelope');
    return JSON.parse(response.content[0].text);
  });
  await client.close(); client = undefined;
  if (mcpOwned) { await mcpOwned.closed; mcpOwned.result(); mcpOwned = undefined; }
  report.retrievalVersionUnchanged = (await journey()).version === versionBefore;
  if (!report.retrievalVersionUnchanged) failure('retrieval-mutated-fixture');
  report.resourcesBefore = await snapshot();
  for (let i = 0; i < 5; i++) {
    const before = await snapshot(), recordsBefore = await store.info();
    await command({ action: 'enqueueJob', journeyId: 'J', expectedVersion: (await journey()).version, limits: { ...fixture.limits, deadlineMs: 10000 } });
    const controller = new AbortController(), start = performance.now();
    let ready;
    const started = new Promise(resolve => { ready = resolve; });
    const pending = runNextFixture(store, { scenario: 'delayed-stream', signal: controller.signal, onProgress: event => { if (event === 'provider-request') ready(); } });
    let result;
    try { await Promise.race([started, pending.then(() => { throw new Error('worker-ended-before-request'); })]); }
    finally { controller.abort(); result = await pending; }
    const after = await snapshot();
    const passed = result.status === 'settled' && result.job.state === 'cancelled' && result.metrics.requests >= 1;
    report.cycles.push({ cycle: i + 1, elapsedMs: performance.now() - start, status: result.status, state: result.job?.state ?? null,
      providerRequests: result.metrics?.requests ?? 0, forcedKill: result.forcedKill ?? null, before, after, recordsBefore, recordsAfter: await store.info(), passed });
    if (!passed) failure(`worker-cycle-${i + 1}`);
  }
  report.resourcesAfter = await snapshot();
  const exported = join(root, 'before.json'), ledger = join(root, 'removals.json'), backup = join(root, 'backup.sqlite'), restored = join(root, 'restored.sqlite');
  await store.administer({ action: 'export', destination: exported });
  await store.administer({ action: 'exportRemovalLedger', destination: ledger });
  const recoveryStart = performance.now(), backupStart = performance.now();
  const artifact = await store.administer({ action: 'backup', destination: backup });
  const backupMs = performance.now() - backupStart, restoreStart = performance.now();
  await store.administer({ action: 'restoreBackup', source: backup, destination: restored, ledger, checksum: artifact.checksum });
  const restoreMs = performance.now() - restoreStart;
  const copy = await SqliteStorage.open(restored);
  try {
    const output = join(root, 'after.json'); await copy.administer({ action: 'export', destination: output });
    const original = JSON.parse(await readFile(exported, 'utf8')), recovered = JSON.parse(await readFile(output, 'utf8'));
    const equal = isDeepStrictEqual(original.tables, recovered.tables);
    report.recovery = { backupMs, restoreMs, backupRestoreAndComparisonMs: performance.now() - recoveryStart, semanticTablesEqual: equal,
      tableRowCounts: Object.fromEntries(Object.entries(original.tables).map(([k, v]) => [k, v.length])), checksum: artifact.checksum,
      boundary: 'SQLite backup API, restore to new test-owned location with removal ledger, re-export and exact semantic table comparison; no existing store overwritten.' };
    if (!equal) failure('semantic-restore-mismatch');
  } finally { await copy.close(); }
} catch (error) { failure(`measurement-aborted:${error instanceof Error ? error.message.slice(0, 160).replace(/[\\/].*/, '[path omitted]') : 'unknown'}`); }
finally {
  try { if (client) await client.close(); } catch { failure('mcp-close'); }
  try { if (mcpOwned) await mcpOwned.stop(); } catch { failure('mcp-child-cleanup'); }
  try { if (store) await store.close(); } catch { failure('store-close'); }
  try { if (root) await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); report.tempTeardown = true; } catch { report.tempTeardown = false; failure('temp-teardown'); }
}
for (const name of ['cold', 'warm']) {
  const attempts = report[name];
  while (attempts.length < 30) attempts.push({ attempt: attempts.length + 1, status: 'missing', elapsedMs: null, completionMs: 'Infinity' });
  const ordered = attempts.map(a => a.status === 'usable' ? a.elapsedMs : Infinity).sort((a, b) => a - b);
  const p95 = ordered[28], failures = attempts.filter(a => a.status !== 'usable').length;
  report[`${name}Summary`] = { denominator: 30, failures, p95Ms: Number.isFinite(p95) ? p95 : 'Infinity', passed: failures === 0 && p95 <= 1000 };
  if (!report[`${name}Summary`].passed) failure(`${name}-acceptance`);
}
report.finishedAt = new Date().toISOString();
report.passed = report.failures.length === 0;
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
