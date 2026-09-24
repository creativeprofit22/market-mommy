import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteStorage } from './adapters/sqlite/client.js';
import { createTrustedContext, type Capability } from './application/authorization.js';
import { dispatchFailure, type DispatchResult } from './application/dispatch.js';
import { DomainError } from './domain/errors.js';

export interface LaunchOptions { storePath: string; capabilities?: readonly Capability[] }
export interface Application { dispatch(json: string): Promise<DispatchResult>; close(): Promise<void> }
/** Trusted process configuration only; the returned facade has no administrative storage API. */
export async function createApplication(options: LaunchOptions): Promise<Application> {
  const capabilities = options.capabilities ?? ['read'];
  createTrustedContext(capabilities);
  const store = await SqliteStorage.open(options.storePath, capabilities);
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let closing: Promise<void> | undefined;
  return {
    dispatch(json) {
      if (closing || pending >= 16) return Promise.resolve(dispatchFailure(new DomainError('unavailable'), json));
      pending++;
      const result = tail.then(() => store.dispatch(json));
      tail = result.catch(() => {}).finally(() => { pending--; });
      return result;
    },
    close() { return closing ??= tail.then(() => store.close()); },
  };
}

/** No environment/cwd defaults, implicit write grants, arbitrary deadlines or runner flags. */
export function parseLaunchOptions(args: readonly string[]): LaunchOptions {
  let storePath: string | undefined;
  let capabilities: Capability[] = ['read'];
  let scopeSeen = false;
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (!value) throw new DomainError('validation');
    if (args[i] === '--store' && storePath === undefined) storePath = value;
    else if (args[i] === '--capabilities' && !scopeSeen) {
      scopeSeen = true;
      capabilities = value.split(',') as Capability[];
      createTrustedContext(capabilities);
    } else throw new DomainError('validation');
  }
  if (!storePath || !isAbsolute(storePath) || /^[/\\]{2}/.test(storePath)) throw new DomainError('validation');
  return { storePath, capabilities };
}

export function isEntryPoint(url: string): boolean {
  return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);
}
export function validateLaunchPaths(): void {
  if (!isAbsolute(process.execPath) || !process.argv[1] || !isAbsolute(process.argv[1]) || process.versions.node !== '24.21.0') throw new DomainError('validation');
}
