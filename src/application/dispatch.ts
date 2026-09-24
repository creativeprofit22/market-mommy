import { z } from 'zod';
import { validate, nextVersion, referenceSchema, type Reference } from '../domain/common.js';
import { DomainError } from '../domain/errors.js';
import { HOST_LIMITS } from '../domain/job.js';
import { type Journey } from '../domain/journey.js';
import { recordKindSchema, storedRecordSchema, type StoredRecord } from '../domain/records.js';
import { authorize, type TrustedContext } from './authorization.js';
import { canonicalCommand, failure, historyPageRequestSchema, parseCommand, resultSchema, type Command } from './commands.js';
import { jobStatusesSchema, type UnitOfWork } from './ports.js';

export const dispatchDataSchema = z.strictObject({
  records: z.array(storedRecordSchema).max(64),
  jobStatuses: jobStatusesSchema.max(61).default([]),
  historyPage: z.strictObject({
    offset: z.number().int().min(0).max(5_000),
    total: z.number().int().min(0).max(5_000),
    next: historyPageRequestSchema.nullable(),
  }).optional(),
  jobSummary: z.strictObject({
    total: z.number().int().min(0).max(1_000),
    active: z.number().int().min(0).max(1_000),
    unresolved: z.number().int().min(0).max(1_000),
  }).optional(),
  nextSafeStep: z.string().max(200), reconciliationRequired: z.boolean(),
  independentOrigins: z.array(z.string().max(80)).max(50),
  independentOriginsComplete: z.boolean().default(true),
  removedDependencies: z.array(referenceSchema.extend({ kind: recordKindSchema })).max(102).default([]),
});
export const dispatchResultSchema = resultSchema(dispatchDataSchema);
// Historical receipts remain replayable/importable, including the previous 2,000-record contract.
// New dispatch results must pass the stricter schema above before they can be saved.
export const receiptResultSchema = resultSchema(dispatchDataSchema.extend({
  records: z.array(storedRecordSchema).max(2_000),
  jobStatuses: jobStatusesSchema.default([]),
}));
export type DispatchResult = z.infer<typeof dispatchResultSchema>;
type Kind = StoredRecord['kind'];
type RecordOf<K extends Kind> = Extract<StoredRecord, { kind: K }>;
const ref = (record: { id: string; version: number }): Reference => ({ id: record.id, version: record.version });
const same = (a: Reference, b: Reference): boolean => a.id === b.id && a.version === b.version;
const add = (ids: string[], id: string): string[] => [...new Set([...ids, id])];

/** Called only within a UOW transaction, including authorization, reads, receipts and writes. */
export function dispatchCommand(json: string, context: TrustedContext, uow: UnitOfWork, now: string): DispatchResult {
  const command = parseCommand(json);
  authorize(context, command.action);
  const semantic = canonicalCommand(command);
  if ('requestId' in command) {
    const receipt = uow.receipt(command.requestId);
    if (receipt) {
      if (receipt.semantic !== semantic) throw new DomainError('conflict');
      return validate(receiptResultSchema, receipt.result);
    }
  }
  const records: StoredRecord[] = [];
  function get<K extends Kind>(kind: K, id: string, version?: number): RecordOf<K> {
    const record = uow.read(id, version);
    if (!record) throw new DomainError('not-found');
    if (record.kind !== kind) throw new DomainError('conflict');
    return record as RecordOf<K>;
  }
  const removedDependencies: { id: string; version: number; kind: Kind }[] = [];
  function dependency<K extends Kind>(kind: K, id: string, version?: number): RecordOf<K> | null {
    const found = uow.lookup(id, version);
    if (found.status === 'missing') throw new DomainError('not-found');
    if (found.status === 'available') {
      if (found.record.kind !== kind) throw new DomainError('conflict');
      return found.record as RecordOf<K>;
    }
    if (found.kind !== kind) throw new DomainError('conflict');
    if (!removedDependencies.some(item => item.id === id && item.version === found.version)) {
      removedDependencies.push({ kind, id, version: found.version });
    }
    return null;
  }
  function put(record: StoredRecord, expectedVersion: number, dependencies: Reference[] = []): void {
    const checked = validate(storedRecordSchema, record);
    const unique = dependencies.filter((item, index) => dependencies.findIndex(other => same(item, other)) === index);
    uow.append([{ record: checked, expectedVersion, dependencies: unique }]);
    records.push(checked);
  }
  function journey(id: string, expected?: number): Journey {
    const value = get('journey', id).data;
    if (expected !== undefined) nextVersion(value.version, expected);
    if (command.action === 'resumeJourney' || command.action === 'cancelJob') dependency('profile', value.profile.id, value.profile.version);
    else get('profile', value.profile.id, value.profile.version);
    return value;
  }
  function saveJourney(value: Journey): void {
    put({ kind: 'journey', data: { ...value, version: value.version + 1 } }, value.version, [value.profile, ...value.history, ...value.priorLearning]);
  }
  function current<K extends Kind>(kind: K, reference: Reference): RecordOf<K> {
    const value = get(kind, reference.id);
    if (value.data.version !== reference.version) throw new DomainError('conflict');
    return value;
  }
  function adviceReference(kind: 'recommendation' | 'offer', reference: Reference, j: Journey): StoredRecord {
    const value = current(kind, reference);
    if (value.data.journeyId !== j.id) throw new DomainError('conflict');
    if (value.kind === 'recommendation' && (value.data.validity !== 'current' || !same(value.data.profile, j.profile))) throw new DomainError('conflict');
    return value;
  }
  function membership(j: Journey, evidenceRef: Reference): void {
    const e = current('evidence', evidenceRef).data;
    const o = current('observation', e.observation).data;
    if (e.independentOrigin !== o.originId) throw new DomainError('conflict');
    j.workload = { ...j.workload, evidenceIds: add(j.workload.evidenceIds, e.id), sourceIds: add(j.workload.sourceIds, o.sourceId) };
  }
  function history(j: Journey, reference: Reference): void {
    if (!j.history.some(item => same(item, reference))) j.history.push(reference);
  }
  function invalidate(id: string): void {
    // Shared dependencies are inspected across all Journeys, not just the caller's Journey.
    for (const kind of ['interpretation', 'recommendation'] as const) {
      for (const item of uow.list(kind)) {
        if (item.kind !== kind || !('validity' in item.data)) continue;
        const data = item.data;
        const dependencies = [data.profile, ...data.evidence, ...('counterevidence' in data ? data.counterevidence : [])];
        if (data.validity === 'current' && dependencies.some(dependency => dependency.id === id)) {
          put({ ...item, data: { ...data, version: data.version + 1, validity: 'reassessment-required' } } as StoredRecord, data.version, dependencies);
        }
      }
    }
  }
  let historyPage: z.infer<typeof dispatchDataSchema>['historyPage'];
  let selected: Journey | undefined;
  let unavailable = false;
  switch (command.action) {
    case 'saveProfile': {
      const before = uow.read(command.profileId);
      if (before && before.kind !== 'profile') throw new DomainError('conflict');
      const dependents = uow.list('journey').filter((r): r is RecordOf<'journey'> => r.kind === 'journey' && r.data.profile.id === command.profileId);
      if (dependents.length && !command.journeyId) throw new DomainError('validation');
      if (command.journeyId && journey(command.journeyId).profile.id !== command.profileId) throw new DomainError('conflict');
      const version = nextVersion(before?.data.version ?? 0, command.expectedVersion);
      const data = { ...command.profile, id: command.profileId, version, createdAt: before?.data.createdAt ?? now };
      put({ kind: 'profile', data }, command.expectedVersion);
      invalidate(data.id);
      for (const dependent of dependents) saveJourney({ ...dependent.data, profile: ref(data) });
      if (command.journeyId) selected = journey(command.journeyId);
      break;
    }
    case 'createJourney': {
      if (command.expectedVersion !== 0 || uow.read(command.journeyId)) throw new DomainError('conflict');
      const p = current('profile', { id: command.profileId, version: command.profileVersion });
      for (const prior of command.priorLearning) {
        const previous = get('journey', prior.id, prior.version);
        if (previous.data.profile.id !== p.data.id || previous.data.id === command.journeyId) throw new DomainError('conflict');
      }
      selected = { id: command.journeyId, version: 1, createdAt: now, profile: ref(p.data), state: 'profile-draft', lastSavedStep: 'profile-saved', selectedExperiment: null, history: [], priorLearning: command.priorLearning, jobIds: [], workload: { sourceIds: [], evidenceIds: [], directionIds: [], experimentIds: [] }, costs: { actualMinorUnits: '0', outstandingMinorUnits: '0', unknownMinorUnits: '0' } };
      put({ kind: 'journey', data: selected }, 0, [selected.profile, ...selected.priorLearning]);
      break;
    }
    case 'resumeJourney': {
      selected = journey(command.journeyId);
      records.push({ kind: 'journey', data: selected });
      const profile = dependency('profile', selected.profile.id, selected.profile.version);
      if (profile) records.push(profile);
      if (selected.selectedExperiment) {
        const experiment = dependency('experiment', selected.selectedExperiment.id, selected.selectedExperiment.version);
        if (experiment) {
          if (experiment.data.journeyId !== selected.id) throw new DomainError('conflict');
          records.push(experiment);
        }
      }
      const page = command.historyPage ?? { offset: 0, limit: 32 };
      if (page.journeyVersion !== undefined && page.journeyVersion !== selected.version) throw new DomainError('conflict');
      // Stable membership order for Jobs, followed by advice in kind/id order. Base records repeat on every page.
      const advice = (['interpretation', 'recommendation'] as const).flatMap(kind =>
        uow.list(kind).filter(r => 'journeyId' in r.data && r.data.journeyId === selected?.id));
      const total = selected.jobIds.length + advice.length;
      if (page.offset > total) throw new DomainError('validation');
      const end = Math.min(page.offset + page.limit, total);
      for (let index = page.offset; index < end; index++) {
        if (index < selected.jobIds.length) {
          const job = get('job', selected.jobIds[index]!);
          if (job.data.journeyId !== selected.id) throw new DomainError('conflict');
          records.push(job);
        } else records.push(advice[index - selected.jobIds.length]!);
      }
      historyPage = { offset: page.offset, total, next: end < total ? { offset: end, limit: page.limit, journeyVersion: selected.version } : null };
      break;
    }
    case 'acceptFixtureEvidence': {
      selected = journey(command.journeyId, command.expectedVersion);
      const oldO = uow.read(command.observationId);
      const oldE = uow.read(command.evidenceId);
      if (oldO && oldO.kind !== 'observation' || oldE && oldE.kind !== 'evidence') throw new DomainError('conflict');
      const ov = nextVersion(oldO?.data.version ?? 0, command.expectedObservationVersion);
      const ev = nextVersion(oldE?.data.version ?? 0, command.expectedEvidenceVersion);
      if (oldE?.kind === 'evidence' && oldE.data.observation.id !== command.observationId) throw new DomainError('conflict');
      if (!same(command.evidence.observation, { id: command.observationId, version: ov }) || command.evidence.independentOrigin !== command.observation.originId) throw new DomainError('conflict');
      // Origin/source identity is immutable: correcting text cannot hide consumed source workload.
      if (oldO?.kind === 'observation' && (oldO.data.sourceId !== command.observation.sourceId || oldO.data.originId !== command.observation.originId)) throw new DomainError('conflict');
      for (const contradiction of command.evidence.contradictions) current('evidence', contradiction);
      put({ kind: 'observation', data: { ...command.observation, id: command.observationId, version: ov, createdAt: oldO?.data.createdAt ?? now } }, command.expectedObservationVersion);
      const data = { ...command.evidence, id: command.evidenceId, version: ev, createdAt: oldE?.data.createdAt ?? now };
      put({ kind: 'evidence', data }, command.expectedEvidenceVersion, [data.observation, ...data.contradictions]);
      // Observation correction also invalidates advice using other evidence backed by it.
      for (const e of uow.list('evidence')) if (e.kind === 'evidence' && e.data.observation.id === command.observationId) invalidate(e.data.id);
      membership(selected, ref(data)); history(selected, ref(data));
      if (!selected.selectedExperiment) { selected.state = 'evidence-review'; selected.lastSavedStep = 'evidence-review'; }
      saveJourney(selected);
      break;
    }
    case 'reuseFixtureEvidence': {
      selected = journey(command.journeyId, command.expectedVersion);
      for (const e of command.evidence) { membership(selected, e); history(selected, e); }
      saveJourney(selected); break;
    }
    case 'saveFixtureAdvice': {
      selected = journey(command.journeyId, command.expectedVersion);
      const { record } = command;
      if (record.data.journeyId !== selected.id || record.data.version !== command.expectedRecordVersion + 1) throw new DomainError('conflict');
      const dependencies: Reference[] = [];
      if (record.kind === 'offer') {
        const recommendation = adviceReference('recommendation', record.data.recommendation, selected);
        if (recommendation.kind !== 'recommendation' || recommendation.data.decision.kind !== 'action') throw new DomainError('conflict');
        dependencies.push(record.data.recommendation);
        if (!selected.selectedExperiment) { selected.state = 'offer-prepared'; selected.lastSavedStep = 'offer-prepared'; }
      } else {
        if (!same(record.data.profile, selected.profile) || record.data.validity !== 'current') throw new DomainError('conflict');
        current('profile', record.data.profile);
        dependencies.push(record.data.profile, ...record.data.evidence, ...(record.kind === 'recommendation' ? record.data.counterevidence : []));
        for (const e of dependencies.slice(1)) membership(selected, e);
        if (record.kind === 'recommendation') {
          selected.workload.directionIds = add(selected.workload.directionIds, record.data.id);
          if (!selected.selectedExperiment) { selected.state = 'direction-selected'; selected.lastSavedStep = 'direction-selected'; }
        }
      }
      put(record, command.expectedRecordVersion, dependencies);
      history(selected, ref(record.data)); saveJourney(selected); break;
    }
    case 'startExperiment': {
      selected = journey(command.journeyId, command.expectedVersion);
      if (selected.selectedExperiment || uow.read(command.experimentId)) throw new DomainError('conflict');
      adviceReference('recommendation', command.baseline.recommendation, selected);
      const offer = adviceReference('offer', command.baseline.offer, selected);
      if (offer.kind !== 'offer' || !same(offer.data.recommendation, command.baseline.recommendation)) throw new DomainError('conflict');
      const data = { id: command.experimentId, version: 1, createdAt: now, journeyId: selected.id, baseline: command.baseline, state: 'active' as const, amendments: [] };
      put({ kind: 'experiment', data }, 0, [data.baseline.offer, data.baseline.recommendation]);
      selected.selectedExperiment = ref(data); selected.workload.experimentIds = add(selected.workload.experimentIds, data.id);
      selected.state = 'experiment-active'; selected.lastSavedStep = 'experiment-active'; history(selected, ref(data)); saveJourney(selected); break;
    }
    case 'recordOutcome': {
      selected = journey(command.journeyId, command.expectedVersion);
      const experiment = get('experiment', command.outcome.experimentId);
      if (experiment.data.journeyId !== selected.id || selected.selectedExperiment?.id !== experiment.data.id || uow.read(command.outcomeId)) throw new DomainError('conflict');
      if (command.outcome.supersedes) {
        const previous = current('outcome', command.outcome.supersedes);
        if (previous.data.journeyId !== selected.id || previous.data.experimentId !== experiment.data.id) throw new DomainError('conflict');
        if (uow.list('outcome').some(item => item.kind === 'outcome' && item.data.supersedes && same(item.data.supersedes, command.outcome.supersedes!))) throw new DomainError('conflict');
      }
      const data = { ...command.outcome, id: command.outcomeId, version: 1, createdAt: now, journeyId: selected.id };
      put({ kind: 'outcome', data }, 0, [ref(experiment.data), ...(data.supersedes ? [data.supersedes] : [])]);
      selected.state = 'outcome-review'; selected.lastSavedStep = 'outcome-review'; history(selected, ref(data)); saveJourney(selected); break;
    }
    case 'enqueueJob': {
      selected = journey(command.journeyId, command.expectedVersion);
      if (!uow.workflow) throw new DomainError('unavailable');
      const job = uow.workflow.enqueue(selected, command.requestId, command.limits, now);
      records.push({ kind: 'job', data: job });
      selected = journey(selected.id);
      records.push({ kind: 'journey', data: selected });
      break;
    }
    case 'cancelJob': {
      selected = journey(command.journeyId, command.expectedVersion);
      if (!uow.workflow) throw new DomainError('unavailable');
      const job = uow.workflow.cancel(selected, command.jobId, now);
      records.push({ kind: 'job', data: job });
      selected = journey(selected.id);
      records.push({ kind: 'journey', data: selected });
      break;
    }
    default:
      selected = journey(command.journeyId, command.expectedVersion);
      unavailable = true;
  }
  if (selected?.selectedExperiment && command.action === 'cancelJob') {
    const experiment = dependency('experiment', selected.selectedExperiment.id, selected.selectedExperiment.version);
    if (experiment && experiment.data.journeyId !== selected.id) throw new DomainError('conflict');
  }
  const origins = new Set<string>();
  let independentOriginsComplete = true;
  if (selected) for (const id of selected.workload.evidenceIds) {
    const evidence = dependency('evidence', id);
    if (!evidence) { independentOriginsComplete = false; continue; }
    const observation = dependency('observation', evidence.data.observation.id, evidence.data.observation.version);
    if (!observation) { independentOriginsComplete = false; continue; }
    if (evidence.data.independentOrigin !== observation.data.originId) throw new DomainError('conflict');
    origins.add(evidence.data.independentOrigin);
  }
  const jobStatuses = selected ? uow.currentJobStatuses(selected) : [];
  const uncertain = jobStatuses.some(job => job.reconciliationRequired);
  const nextSafeStep = uncertain ? 'reconcile-uncertain-work'
    : jobStatuses.some(job => job.state === 'cancel-requested') ? 'wait-for-cancellation'
    : jobStatuses.some(job => job.state === 'running') ? 'wait-for-job-completion'
    : jobStatuses.some(job => job.state === 'queued') ? 'wait-for-job-start'
    : selected?.lastSavedStep ?? 'profile-saved';
  const result = validate(dispatchResultSchema, unavailable ? failure(new DomainError(command.action === 'collectEvidence' ? 'policy-denied' : 'unavailable'), command) : {
    status: 'ok', journeyId: 'journeyId' in command ? command.journeyId ?? null : null,
    requestId: 'requestId' in command ? command.requestId : null,
    data: { records,
      jobStatuses: jobStatuses.filter(job => records.some(record => record.kind === 'job' && record.data.id === job.jobId)),
      ...(historyPage ? { historyPage } : {}),
      jobSummary: { total: jobStatuses.length, active: jobStatuses.filter(job => ['queued', 'running', 'cancel-requested'].includes(job.state)).length, unresolved: jobStatuses.filter(job => job.reconciliationRequired).length },
      nextSafeStep, reconciliationRequired: uncertain, independentOrigins: [...origins].sort(), independentOriginsComplete, removedDependencies },
    warnings: ['Synthetic fixtures only; no collection, market advice, outreach or paid execution.', ...(removedDependencies.length ? ['Referenced fixture content was removed; payloads remain unavailable and cumulative membership is retained.'] : []), ...(!independentOriginsComplete ? ['Independent-origin metadata is incomplete because referenced fixture content was removed.'] : [])],
  });
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > HOST_LIMITS.inputBytes) throw new DomainError('validation');
  if ('requestId' in command) uow.saveReceipt(command.requestId, 'journeyId' in command ? command.journeyId ?? null : null, semantic, result, now);
  return result;
}

/** Malformed input gets no caller-supplied identity echoed into an error. */
export function dispatchFailure(error: unknown, json: string): DispatchResult {
  let command: Command | undefined;
  try { command = parseCommand(json); } catch { /* no validated identity */ }
  return validate(dispatchResultSchema, failure(error, command));
}
