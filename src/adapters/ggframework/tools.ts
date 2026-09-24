import type { AgentTool } from '@kenkaiiii/gg-agent';
import { referenceSchema } from '../../domain/common.js';
import { HOST_LIMITS, type Job } from '../../domain/job.js';
import type { StoredRecord } from '../../domain/records.js';

export function evidenceTools(job: Job, records: readonly StoredRecord[], abort: () => void): { tools: AgentTool[]; calls: () => number; resetTurn: () => void } {
  const snapshots = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== 'evidence' || !job.inputVersions.some(ref => ref.id === record.data.id && ref.version === record.data.version)) throw new Error('Invalid snapshot');
    snapshots.set(`${record.data.id}:${record.data.version}`, JSON.stringify(record));
  }
  let calls = 0; let turnBytes = 0;
  const tool: AgentTool<typeof referenceSchema> = {
    name: 'read_evidence', description: 'Read one allowlisted immutable synthetic evidence snapshot.',
    parameters: referenceSchema, executionMode: 'sequential', timeoutMs: job.limits.toolTimeoutMs,
    execute(args, context) {
      const ref = referenceSchema.parse(args);
      const text = snapshots.get(`${ref.id}:${ref.version}`);
      if (++calls > job.limits.toolCalls || context.signal.aborted || text === undefined || Buffer.byteLength(text) > HOST_LIMITS.toolResultBytes || turnBytes + Buffer.byteLength(text) > HOST_LIMITS.turnToolResultBytes) {
        abort(); throw new Error('Evidence tool denied');
      }
      turnBytes += Buffer.byteLength(text);
      return text;
    },
  };
  return { tools: [tool as AgentTool], calls: () => calls, resetTurn: () => { turnBytes = 0; } };
}
