import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { DispatchResult } from '../../src/application/dispatch.js';

export const grants = 'read,fixture-write,fixture-run,cancel';
export const sentinel = 'NONSECRET-interface-sentinel-DO-NOT-ECHO';
const script = (kind: 'cli' | 'mcp') => fileURLToPath(new URL(`../../src/interfaces/${kind}.js`, import.meta.url));
const args = (kind: 'cli' | 'mcp', store: string, write: boolean) => [script(kind), '--store', store, ...(write ? ['--capabilities', grants] : [])];
const env = { ...process.env, NODE_NO_WARNINGS: '1', INTERFACE_TEST_SECRET: sentinel };

/** Exact owned child only; bounded capture and wall time; always await close, not merely exit. */
function watch(child: ChildProcess, deadlineMs = 12_000) {
  let stdout = '', stderr = '', fault: Error | undefined;
  const kill = () => { child.kill('SIGKILL'); };
  const timer = setTimeout(() => { fault = new Error('Interface child exceeded deadline'); kill(); }, deadlineMs);
  const capture = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
    if (Buffer.byteLength(stream === 'stdout' ? stdout : stderr) + chunk.length > 2 * 1024 * 1024) {
      fault = new Error(`${stream} exceeded capture limit`); kill(); return;
    }
    if (stream === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
  };
  child.stdout?.on('data', chunk => capture('stdout', chunk));
  child.stderr?.on('data', chunk => capture('stderr', chunk));
  child.stdin?.on('error', () => {}); // early safe rejection may close the input pipe
  child.once('error', error => { fault = error; });
  const closed = new Promise<void>(resolve => child.once('close', () => { clearTimeout(timer); resolve(); }));
  return { closed, async stop() { if (child.exitCode === null && child.signalCode === null) kill(); await closed; }, result() {
    if (fault) throw fault;
    assert.ok(!stdout.includes(sentinel)); assert.ok(!stderr.includes(sentinel));
    return { stdout, stderr, code: child.exitCode };
  } };
}
export async function raw(kind: 'cli' | 'mcp', store: string, cwd: string, input: string, write = false, eof = true) {
  const child = spawn(process.execPath, args(kind, store, write), { cwd, env, shell: false, stdio: 'pipe' });
  const owned = watch(child);
  try { child.stdin.write(input); if (eof) child.stdin.end(); await owned.closed; return owned.result(); }
  finally { await owned.stop(); }
}
export async function cli(store: string, cwd: string, command: unknown, write = true): Promise<DispatchResult> {
  const result = await raw('cli', store, cwd, JSON.stringify(command), write);
  assert.equal(result.stderr, '');
  const envelope = JSON.parse(result.stdout) as DispatchResult;
  assert.equal(result.stdout, JSON.stringify(envelope) + '\n');
  assert.equal(result.code, envelope.status === 'ok' ? 0 : 1);
  return envelope;
}
export async function mcp(store: string, cwd: string, write = true) {
  const transport = new StdioClientTransport({ command: process.execPath, args: args('mcp', store, write), cwd, env, stderr: 'pipe', maxBufferSize: 2 * 1024 * 1024 });
  // Pinned SDK has no public child-close promise. Inspect only the owned child for lifecycle/capture assertions.
  const client = new Client({ name: 'interface-tests', version: '1' });
  const connecting = client.connect(transport);
  const child = (transport as unknown as { _process: ChildProcess })._process;
  assert.ok(child);
  const owned = watch(child, 120_000);
  try { await connecting; } catch (error) { await owned.stop(); throw error; }
  return { client, async call(command: Record<string, unknown>): Promise<DispatchResult> {
    const { action, ...arguments_ } = command;
    const response = await client.callTool({ name: String(action), arguments: arguments_ });
    const content = response.content as { type: string; text: string }[];
    assert.equal(content.length, 1); assert.equal(content[0]!.type, 'text');
    const result = JSON.parse(content[0]!.text) as DispatchResult;
    assert.equal(response.isError, result.status === 'error');
    return result;
  }, async close() {
    try {
      await client.close(); await owned.closed;
      const result = owned.result(); assert.equal(result.code, 0); assert.equal(result.stderr, '');
      for (const line of result.stdout.trim().split('\n')) assert.equal(JSON.parse(line).jsonrpc, '2.0');
    } finally { await owned.stop(); }
  } };
}
