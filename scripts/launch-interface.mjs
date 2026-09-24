import './check-runtime.mjs';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (mode !== 'cli' && mode !== 'mcp') process.exit(1);
const entry = new URL(`../dist/src/interfaces/${mode}.js`, import.meta.url);
process.argv = [process.execPath, fileURLToPath(entry), ...process.argv.slice(3)];
try { await import(entry.href); }
catch { process.stderr.write('Market Mommy interface could not start.\n'); process.exitCode = 1; }
