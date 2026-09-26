// Loopback-only static server for the labeled-fixture UI prototype.
// Serves an exact allowlist of files; no directory listing, no writes, no outbound requests.
import { createServer } from 'node:http';
import { lstat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4317;
const publicDir = new URL('../ui/prototype/public/', import.meta.url);
const appDir = new URL('../dist/ui-prototype/', import.meta.url);

const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' };
const modules = ['main', 'render', 'journey-model', 'fixtures', 'icons'];
// Screen addresses; must match allRoutePaths() in ui/prototype/src/journey-model.ts (checked by tests).
const screenPaths = ['/', '/index.html', '/welcome', '/about/skill', '/about/hours', '/about/money', '/about/timing', '/stop-here', '/options', '/next-step', '/record', '/progress'];
const page = { file: new URL('index.html', publicDir), type: types.html };
const routes = new Map([
  ...screenPaths.map((path) => [path, page]),
  ['/styles.css', { file: new URL('styles.css', publicDir), type: types.css }],
  ...modules.map((name) => [`/app/${name}.js`, { file: new URL(`${name}.js`, appDir), type: types.js }]),
]);

const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

function parsePort(argv) {
  const index = argv.indexOf('--port');
  if (index === -1) return DEFAULT_PORT;
  const value = argv[index + 1] ?? '';
  if (!/^\d{1,5}$/.test(value) || Number(value) > 65535) throw new Error(`Invalid --port value: ${value}`);
  return Number(value);
}

function send(res, status, body, extra = {}) {
  res.writeHead(status, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(body);
}

async function handle(req, res, port) {
  const allowedHosts = new Set([`${HOST}:${port}`, `localhost:${port}`]);
  if (!allowedHosts.has(req.headers.host ?? '')) return send(res, 421, 'Unknown host\n');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
  let pathname;
  try {
    pathname = new URL(req.url ?? '/', `http://${HOST}`).pathname;
  } catch {
    return send(res, 400, 'Bad request\n');
  }
  const route = routes.get(pathname);
  if (!route) return send(res, 404, 'Not found\n');
  const file = fileURLToPath(route.file);
  const info = await lstat(file).catch(() => null);
  if (!info || !info.isFile()) return send(res, 404, 'Not found\n');
  const body = await readFile(file);
  res.writeHead(200, { ...securityHeaders, 'Content-Type': route.type, 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const port = parsePort(process.argv.slice(2));
const server = createServer((req, res) => {
  const started = performance.now();
  handle(req, res, server.address()?.port ?? port)
    .catch(() => { if (!res.headersSent) send(res, 500, 'Server error\n'); else res.destroy(); })
    .finally(() => {
      process.stderr.write(`${JSON.stringify({ event: 'request', method: req.method, path: (req.url ?? '').slice(0, 200), status: res.statusCode, ms: Math.round(performance.now() - started) })}\n`);
    });
});
server.listen(port, HOST, () => {
  const address = server.address();
  process.stdout.write(`Practice prototype: http://${address.address}:${address.port}/\n`);
});
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
