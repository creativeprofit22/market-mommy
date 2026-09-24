import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { StoragePort } from '../../application/ports.js';
import type { WorkflowPort } from '../../application/workflow.js';
import { HOST_LIMITS, type Job } from '../../domain/job.js';
import { DomainError } from '../../domain/errors.js';
import type { FixtureResult } from '../../domain/fixture-result.js';
import type { StoredRecord } from '../../domain/records.js';
import { fixtureOptionsSchema, type FixtureScenario } from '../providers/policy.js';
import { startFixtureProvider, type FixtureMetrics } from '../providers/fixture.js';
import { validateFixtureOutput, workerResultSchema } from './validation.js';

export interface RunFixtureOptions { scenario?: FixtureScenario; signal?: AbortSignal; onProgress?: (event: 'worker-ready' | 'provider-request') => void }
export type RunFixtureResult = { status: 'no-job' } | {
  status: 'settled' | 'fence-lost'; job: Job; output?: FixtureResult;
  metrics: FixtureMetrics; frameworkRetries: number; toolCalls: number; forcedKill: boolean; turns: number; environmentKeyCount: number | null;
};
/** Trusted composition API only; requires fixed read + fixture-run grants. No provider settings, paths, argv or credentials from dispatch. */
export async function runNextFixture(storage: StoragePort & WorkflowPort, options: RunFixtureOptions = {}): Promise<RunFixtureResult> {
  const { signal, onProgress, ...configuration } = options;
  if (onProgress !== undefined && typeof onProgress !== 'function') throw new Error('Invalid progress observer');
  const { scenario = 'success' } = fixtureOptionsSchema.parse(configuration);
  // Check read authority in the owning storage worker before claim can mutate state.
  // Keep authorization failures outside the execution catch/settlement path.
  await storage.info();
  const ownerId = randomUUID();
  const [job] = await storage.workflow({ action: 'claim', ownerId, leaseMs: HOST_LIMITS.deadlineMs });
  if (!job) return { status: 'no-job' };
  const controller = new AbortController();
  let cancelled = false; let fenceLost = false; let forcedKill = false;
  let child: ChildProcess | undefined; let exited: Promise<void> | undefined;
  let closed = false; let stopping = false; let killTimer: ReturnType<typeof setTimeout> | undefined;
  let provider: Awaited<ReturnType<typeof startFixtureProvider>> | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined; let poll: Promise<void> = Promise.resolve();
  let output: FixtureResult | undefined; let frameworkRetries = 0; let toolCalls = 0; let turns = 0; let environmentKeyCount: number | null = null;
  const metrics: FixtureMetrics = { requests: 0, retryResponses: 0, requestBytes: 0, responseBytes: 0, limitExceeded: false };
  const stop = (): void => {
    controller.abort();
    if (!child || closed || stopping) return;
    stopping = true;
    if (child.connected) child.send({ type: 'abort' }, () => {});
    killTimer = setTimeout(() => { if (!closed && child) { forcedKill = true; child.kill('SIGKILL'); } }, 250);
  };
  const notify = (event: 'worker-ready' | 'provider-request'): void => {
    try { onProgress?.(event); } catch { stop(); }
  };
  const cancel = (): void => { cancelled = true; stop(); };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const deadline = setTimeout(stop, Math.max(0, Date.parse(job.deadlineAt) - Date.now()));
  const bounded = async <T>(work: Promise<T>): Promise<T> => {
    if (controller.signal.aborted) { void work.catch(() => {}); throw new Error('Stopped'); }
    return new Promise<T>((resolve, reject) => {
      const abort = (): void => reject(new Error('Stopped'));
      controller.signal.addEventListener('abort', abort, { once: true });
      void work.then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
    });
  };
  const schedulePoll = (): void => {
    pollTimer = setTimeout(() => {
      poll = (async () => {
        try {
          const latest = await bounded(storage.read(job.id));
          if (latest?.kind !== 'job' || latest.data.fence !== job.fence || !['running', 'cancel-requested'].includes(latest.data.state)) { fenceLost = true; stop(); }
          else if (latest.data.state === 'cancel-requested') cancel();
          if (!controller.signal.aborted) schedulePoll();
        } catch { stop(); }
      })();
    }, 100);
  };
  try {
    schedulePoll();
    const records: StoredRecord[] = [];
    for (const ref of job.inputVersions) {
      const record = await bounded(storage.read(ref.id, ref.version));
      if (!record || record.data.id !== ref.id || record.data.version !== ref.version) throw new Error('Missing snapshot');
      if (record.kind === 'evidence') records.push(record);
    }
    const allowed = records.map(record => ({ id: record.data.id, version: record.data.version }));
    provider = await startFixtureProvider(scenario, allowed, stop, () => notify('provider-request'));
    if (controller.signal.aborted) throw new Error('Stopped');
    const input = JSON.stringify({ job, scenario, port: provider.port, token: provider.token, evidence: records });
    if (Buffer.byteLength(input) > HOST_LIMITS.inputBytes) throw new Error('Input limit');
    child = spawn(process.execPath, [fileURLToPath(new URL('./worker.js', import.meta.url))], { env: {}, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const owned = child;
    exited = new Promise<void>(resolve => owned.once('close', () => { closed = true; if (killTimer) clearTimeout(killTimer); resolve(); }));
    let bytes = 0; let messages = 0;
    const result = new Promise<string>((resolve, reject) => {
      const rejectSafe = (): void => reject(new Error('Worker failed'));
      owned.once('error', rejectSafe);
      owned.once('close', rejectSafe);
      const drain = (chunk: Buffer): void => { bytes += chunk.length; if (bytes > job.limits.outputBytes) { stop(); rejectSafe(); } };
      owned.stdout?.on('data', drain); owned.stderr?.on('data', drain);
      owned.on('message', (message: unknown) => {
        bytes += Buffer.byteLength(JSON.stringify(message));
        if (message && typeof message === 'object' && 'type' in message && message.type === 'ready' && Object.keys(message).length === 1) {
          if (++messages !== 1) { stop(); rejectSafe(); return; }
          notify('worker-ready'); return;
        }
        const parsed = workerResultSchema.safeParse(message);
        if (++messages > 2 || bytes > job.limits.outputBytes + 1024 || !parsed.success || controller.signal.aborted) { stop(); rejectSafe(); return; }
        frameworkRetries = parsed.data.retries; toolCalls = parsed.data.toolCalls; turns = parsed.data.turns; environmentKeyCount = parsed.data.environmentKeyCount;
        resolve(parsed.data.text);
      });
      owned.send(JSON.parse(input) as object, error => { if (error) rejectSafe(); });
    });
    output = validateFixtureOutput(await bounded(result), allowed, job.limits.outputBytes);
    // A valid result is not process cleanup. Allow the owned child to exit normally,
    // still under the job deadline/cancellation fence, before invoking forced teardown.
    await bounded(exited);
  } catch { output = undefined; }
  finally {
    stop();
    if (pollTimer) clearTimeout(pollTimer);
    await poll;
    if (exited) await exited;
    if (killTimer) clearTimeout(killTimer);
    if (provider) { await provider.close(); Object.assign(metrics, provider.metrics); }
    clearTimeout(deadline); signal?.removeEventListener('abort', cancel);
    child?.removeAllListeners();
  }
  // Cleanup is complete before durable settlement. Expired leases are quarantined by storage.
  if (cancelled || fenceLost || metrics.limitExceeded) output = undefined;
  const currentJob = async (): Promise<Job> => {
    const current = await storage.read(job.id);
    // Missing/unreadable current state is an error, never the original running snapshot.
    if (current?.kind !== 'job') throw new DomainError('unavailable');
    return current.data;
  };
  if (fenceLost) return { status: 'fence-lost', job: await currentJob(), metrics, frameworkRetries, toolCalls, forcedKill, turns, environmentKeyCount };
  try {
    const [settled] = await storage.workflow({ action: 'settle', jobId: job.id, journeyId: job.journeyId, ownerId, fence: job.fence,
      state: cancelled ? 'cancelled' : output ? 'succeeded' : 'failed',
      // Known zero only because ALL possible requests use this owned synthetic protocol.
      actualMinorUnits: 0, providerRequestId: null, ...(output ? { validatedResult: output } : {}),
    });
    if (!settled) throw new Error('Missing settlement');
    return { status: 'settled', job: settled, ...(settled.state === 'succeeded' && output ? { output } : {}), metrics, frameworkRetries, toolCalls, forcedKill, turns, environmentKeyCount };
  } catch (error) {
    // A late completion must not overwrite recovery/cancellation or release unknown reservations.
    if (error instanceof DomainError && error.code === 'conflict') {
      const current = await currentJob();
      // A conflict with the same active fence is not evidence of ownership loss.
      if (current.fence === job.fence && ['running', 'cancel-requested'].includes(current.state)) throw error;
      return { status: 'fence-lost', job: current, metrics, frameworkRetries, toolCalls, forcedKill, turns, environmentKeyCount };
    }
    throw error;
  }
}
