import { DomainError } from '../domain/errors.js';
import type { CommandAction } from './commands.js';

export type Capability = 'read' | 'fixture-write' | 'fixture-run' | 'cancel';
export interface TrustedContext { readonly kind: 'local-launch-context' }
const grants = new WeakMap<TrustedContext, ReadonlySet<Capability>>();
const knownCapabilities: readonly Capability[] = ['read', 'fixture-write', 'fixture-run', 'cancel'];

/** Composition only: process startup decides scope. Never call with tool/request arguments. */
export function createTrustedContext(capabilities: readonly Capability[] = ['read']): TrustedContext {
  if (capabilities.some(value => !knownCapabilities.includes(value))) throw new DomainError('unauthorized');
  const context: TrustedContext = Object.freeze({ kind: 'local-launch-context' });
  grants.set(context, new Set(capabilities));
  return context;
}
const required: Record<CommandAction, Capability> = {
  resumeJourney: 'read', saveProfile: 'fixture-write', createJourney: 'fixture-write',
  reuseFixtureEvidence: 'fixture-write', saveFixtureAdvice: 'fixture-write',
  acceptFixtureEvidence: 'fixture-write', startExperiment: 'fixture-write', recordOutcome: 'fixture-write',
  enqueueJob: 'fixture-run', cancelJob: 'cancel', collectEvidence: 'fixture-run',
  recommendDirections: 'fixture-run', prepareOffer: 'fixture-write',
};
export function authorize(context: TrustedContext, action: CommandAction): void {
  if (!grants.get(context)?.has(required[action])) throw new DomainError('unauthorized');
}
