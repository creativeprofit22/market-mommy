import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type JSONRPCMessage, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { createApplication, isEntryPoint, parseLaunchOptions, validateLaunchPaths, type Application } from '../composition.js';
import { commandSchema, failure } from '../application/commands.js';
import { DomainError } from '../domain/errors.js';
import { HOST_LIMITS } from '../domain/job.js';

// Derived from the shared strict union, including the typed unavailable actions.
export const domainTools: Tool[] = commandSchema.options.flatMap(option => {
  const action = option.shape.action;
  const names = 'options' in action ? action.options : [action.value];
  const { action: _action, ...fields } = option.shape;
  const inputSchema = z.toJSONSchema(z.strictObject(fields), { target: 'draft-7' }) as Tool['inputSchema'];
  return names.map(name => ({ name, description: `Shared domain command: ${name}. Fixture-only; launch capabilities apply.`, inputSchema }));
});

/** Deliberately explicit validation: unknown keys (including action/scope/path) fail, never get stripped. */
export async function callDomainTool(app: Application, name: string, args: unknown) {
  let result;
  if (!domainTools.some(tool => tool.name === name) || args === null || typeof args !== 'object' || Array.isArray(args) || Object.hasOwn(args, 'action')) {
    result = failure(new DomainError('validation'));
  } else {
    try { result = await app.dispatch(JSON.stringify({ ...args, action: name })); }
    catch (error) { result = failure(error); }
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], isError: result.status === 'error' };
}

/** SDK byte limit is checked in ReadBuffer.append BEFORE its JSON.parse.
 * Also bound every protocol request, not just tools, and outstanding output bytes.
 */
class BoundedStdioTransport extends StdioServerTransport {
  private readonly requests = new Set<string | number>();
  private outputBytes = 0;
  constructor(private readonly fatal: () => void) {
    super(process.stdin, process.stdout, { maxBufferSize: HOST_LIMITS.inputBytes });
  }
  override async start(): Promise<void> {
    const receive = this.onmessage;
    this.onmessage = message => {
      if ('method' in message && 'id' in message) {
        if (this.requests.size >= 16 || this.requests.has(message.id)) { this.fatal(); return; }
        this.requests.add(message.id);
      }
      receive?.(message);
    };
    await super.start();
  }
  override async send(message: JSONRPCMessage): Promise<void> {
    // SDK validation exceptions can contain request values. Never echo them.
    if ('error' in message) message = { jsonrpc: '2.0', id: message.id, error: { code: message.error.code, message: 'Request could not be processed.' } };
    const bytes = Buffer.byteLength(JSON.stringify(message)) + 1;
    if (this.outputBytes + bytes > 8 * 1024 * 1024) { this.fatal(); throw new DomainError('unavailable'); }
    this.outputBytes += bytes;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        super.send(message),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { this.fatal(); reject(new DomainError('unavailable')); }, 5_000); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      this.outputBytes -= bytes;
      if (!('method' in message) && 'id' in message && message.id !== undefined) this.requests.delete(message.id);
    }
  }
}

export function createMcpServer(app: Application): Server {
  const server = new Server({ name: 'market-mommy', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: domainTools }));
  server.setRequestHandler(CallToolRequestSchema, request => callDomainTool(app, request.params.name, request.params.arguments ?? {}));
  return server;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  let app: Application | undefined;
  let server: Server | undefined;
  let stopping = false;
  let failed = false;
  let shutdown: Promise<void> | undefined;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const stop = (): Promise<void> => {
    if (stopping) return shutdown ?? Promise.resolve();
    stopping = true;
    process.stdin.destroy();
    shutdown = (async () => {
      try { await server?.close(); } finally { await app?.close(); finish(); }
    })();
    return shutdown;
  };
  const signal = (): void => { void stop(); };
  const fatal = (): void => {
    if (failed) return;
    failed = true;
    process.exitCode = 1;
    process.stderr.write('Market Mommy MCP stopped safely.\n');
    process.stdout.destroy();
    void stop();
  };
  process.once('SIGINT', signal); process.once('SIGTERM', signal);
  process.stdin.once('end', signal); process.stdin.once('error', fatal);
  process.stdout.once('error', fatal);
  try {
    validateLaunchPaths();
    app = await createApplication(parseLaunchOptions(args));
    if (stopping) { await app.close(); return; }
    server = createMcpServer(app);
    server.onerror = fatal;
    server.onclose = signal;
    await server.connect(new BoundedStdioTransport(fatal));
    await finished;
    await shutdown;
  } catch { fatal(); await shutdown; }
  finally {
    process.off('SIGINT', signal); process.off('SIGTERM', signal);
    process.stdin.off('end', signal); process.stdin.off('error', fatal);
    process.stdout.off('error', fatal);
  }
}
if (isEntryPoint(import.meta.url)) void main().catch(() => { process.exitCode = 1; });
