import { agentLoop } from '@kenkaiiii/gg-agent';
import { HOST_LIMITS } from '../../domain/job.js';
import { workerInputSchema } from './validation.js';
import { evidenceTools } from './tools.js';

const controller = new AbortController();
let started = false;
let completed = false;
process.on('disconnect', () => process.exit(completed ? 0 : 1));
process.on('message', (message: unknown) => {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'abort') { controller.abort(); return; }
  if (started) { controller.abort(); return; }
  started = true;
  void run(message).catch(() => { process.exitCode = 1; if (process.connected) process.disconnect(); });
});
async function run(message: unknown): Promise<void> {
  if (Buffer.byteLength(JSON.stringify(message)) > HOST_LIMITS.inputBytes) throw new Error('Input limit');
  const input = workerInputSchema.parse(message);
  await new Promise<void>((resolve, reject) => process.send?.({ type: 'ready' }, error => error ? reject(error) : resolve()));
  // An explicit finite fixture scenario exercises exact-child forced termination.
  if (input.scenario === 'noncooperative-worker') { setInterval(() => {}, 1000); process.removeAllListeners('message'); return; }
  const timer = setTimeout(() => controller.abort(), Math.max(0, Date.parse(input.job.deadlineAt) - Date.now()));
  const tools = evidenceTools(input.job, input.evidence, () => controller.abort());
  let text = ''; let emitted = 0; let retries = 0; let requestedTools = 0; let turns = 0;
  try {
    const loop = agentLoop([{ role: 'user', content: 'Execute the deterministic synthetic fixture. This is not market research.' }], {
      provider: 'openai', model: 'synthetic-fixture', apiKey: input.token,
      baseUrl: `http://127.0.0.1:${input.port}/v1`, signal: controller.signal,
      tools: tools.tools, maxTurns: input.job.limits.turns, maxTurnExtensions: 0,
      maxContinuations: 0, maxTokens: input.job.limits.outputTokens,
      maxToolResultChars: HOST_LIMITS.toolResultBytes, maxTurnToolResultChars: HOST_LIMITS.turnToolResultBytes,
      webSearch: false, supportsImages: false,
    });
    for await (const event of loop) {
      if (event.type === 'text_delta' || event.type === 'thinking_delta' || event.type === 'toolcall_delta') {
        emitted += Buffer.byteLength(JSON.stringify(event));
        if (emitted > input.job.limits.outputBytes) { controller.abort(); throw new Error('Output limit'); }
      }
      if (event.type === 'tool_call_start' && ++requestedTools > input.job.limits.toolCalls) { controller.abort(); throw new Error('Tool call limit'); }
      if (event.type === 'text_delta') text += event.text;
      if (event.type === 'retry' && ++retries > 12) { controller.abort(); throw new Error('Retry limit'); }
      if (event.type === 'turn_end') {
        if (++turns > input.job.limits.turns) { controller.abort(); throw new Error('Turn limit'); }
        tools.resetTurn();
      }
      if (event.type === 'error') throw new Error('Framework failed');
    }
    if (controller.signal.aborted) throw new Error('Aborted');
    await new Promise<void>((resolve, reject) => process.send?.({ type: 'result', text, retries, toolCalls: tools.calls(), turns, environmentKeyCount: Object.keys(process.env).length }, error => error ? reject(error) : resolve()));
    completed = true;
  } finally { clearTimeout(timer); if (process.connected) process.disconnect(); }
}
