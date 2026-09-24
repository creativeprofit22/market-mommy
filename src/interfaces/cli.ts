import type { Readable } from 'node:stream';
import { createApplication, isEntryPoint, parseLaunchOptions, validateLaunchPaths, type Application } from '../composition.js';
import { failure } from '../application/commands.js';
import { DomainError } from '../domain/errors.js';
import { HOST_LIMITS } from '../domain/job.js';

/** One JSON document terminated by EOF; fixed total wait, including slow trickles. */
export function readCommand(input: Readable, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const timer = setTimeout(fail, 5_000);
    function cleanup(): void {
      clearTimeout(timer);
      input.off('data', data); input.off('end', end); input.off('error', fail);
      signal?.removeEventListener('abort', fail);
      input.pause();
    }
    function fail(): void { cleanup(); reject(new DomainError('validation')); }
    function data(chunk: Buffer | string): void {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > HOST_LIMITS.inputBytes) { fail(); return; }
      chunks.push(buffer);
    }
    function end(): void { cleanup(); resolve(Buffer.concat(chunks, bytes).toString('utf8')); }
    input.on('data', data); input.once('end', end); input.once('error', fail);
    signal?.addEventListener('abort', fail, { once: true });
    if (signal?.aborted) fail();
  });
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  let app: Application | undefined;
  const controller = new AbortController();
  const stop = (): void => { controller.abort(); void app?.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let result;
  try {
    validateLaunchPaths();
    const options = parseLaunchOptions(args);
    // Reject bad/oversized input before opening storage.
    const json = await readCommand(process.stdin, controller.signal);
    app = await createApplication(options);
    result = controller.signal.aborted ? failure(new DomainError('unavailable')) : await app.dispatch(json);
  } catch (error) { result = failure(error); }
  finally {
    await app?.close();
    process.stdin.destroy();
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
  }
  process.exitCode = result.status === 'ok' ? 0 : 1;
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => { process.exitCode = 1; process.stdout.destroy(); resolve(); }, 5_000);
    process.stdout.once('error', () => { process.exitCode = 1; clearTimeout(timer); resolve(); });
    process.stdout.write(JSON.stringify(result) + '\n', () => { clearTimeout(timer); resolve(); });
  });
}
if (isEntryPoint(import.meta.url)) void main().catch(() => { process.exitCode = 1; });
