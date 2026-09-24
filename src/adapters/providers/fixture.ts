import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'node:net';
import { fixtureScenarioSchema, type FixtureScenario } from './policy.js';
import type { Reference } from '../../domain/common.js';
import { HOST_LIMITS } from '../../domain/job.js';

export interface FixtureMetrics { requests: number; retryResponses: number; requestBytes: number; responseBytes: number; limitExceeded: boolean }
/** Parent-owned OpenAI-compatible protocol. Never accepts a destination or user script. */
export async function startFixtureProvider(scenario: FixtureScenario, evidence: readonly Reference[], onLimit: () => void, onRequest?: () => void): Promise<{ port: number; token: string; metrics: FixtureMetrics; close: () => Promise<void> }> {
  fixtureScenarioSchema.parse(scenario);
  if (evidence.length > 50) throw new Error('Fixture input limit');
  const token = randomUUID();
  const metrics: FixtureMetrics = { requests: 0, retryResponses: 0, requestBytes: 0, responseBytes: 0, limitExceeded: false };
  const sockets = new Set<Socket>();
  let closed = false;
  const server = createServer((req, res) => {
    if (metrics.limitExceeded || ++metrics.requests > 12) { metrics.limitExceeded = true; onLimit(); req.destroy(); server.closeAllConnections(); server.close(); return; }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions' || req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403).end(); return; }
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length; metrics.requestBytes += chunk.length;
      if (size > HOST_LIMITS.inputBytes) { metrics.limitExceeded = true; onLimit(); req.destroy(); }
    });
    req.on('error', () => {});
    req.on('end', () => {
      if (req.destroyed || closed) return;
      onRequest?.();
      if (scenario === 'retry-responses' && metrics.requests <= 3) {
        metrics.retryResponses++; res.writeHead(500, { 'content-type': 'application/json', 'retry-after': '0' }).end('{"error":{"message":"Synthetic retry","type":"server_error"}}'); return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      if (scenario === 'delayed-stream') { res.flushHeaders(); return; }
      const send = (delta: unknown, finish: string | null): void => {
        const frame = `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 0, model: 'synthetic-fixture', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
        metrics.responseBytes += Buffer.byteLength(frame);
        if (metrics.responseBytes > HOST_LIMITS.jobTextBytes * 2) { metrics.limitExceeded = true; onLimit(); res.destroy(); return; }
        res.write(frame);
      };
      if (scenario === 'read-evidence' && evidence.length > 0 && metrics.requests === 1) {
        send({ role: 'assistant', tool_calls: [{ index: 0, id: 'fixture-read', type: 'function', function: { name: 'read_evidence', arguments: JSON.stringify(evidence[0]) } }] }, null);
        send({}, 'tool_calls');
      } else {
        const text = scenario === 'malformed-output' ? 'not JSON' : scenario === 'excessive-output' ? 'x'.repeat(HOST_LIMITS.jobTextBytes + 1) : JSON.stringify({ scope: 'synthetic-fixture', label: 'Deterministic synthetic fixture; not market research.', evidence: scenario === 'read-evidence' ? evidence.slice(0, 1) : [] });
        send({ role: 'assistant', content: text }, null); send({}, 'stop');
      }
      res.end('data: [DONE]\n\n');
    });
  });
  server.maxConnections = 4;
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  const close = async (): Promise<void> => {
    if (closed) return; closed = true;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  };
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture unavailable');
    return { port: address.port, token, metrics, close };
  } catch (error) { await close(); throw error; }
}
