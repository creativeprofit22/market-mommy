// Prepares a synthetic, read-only GG Coder host smoke-test store. Never registers MCP or edits host settings.
// Usage (after `npm run build`): node scripts/prepare-host-smoke.mjs --dir <absolute directory>
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PINNED = 'v24.21.0';
const CLI_DEADLINE_MS = 30_000;
const profile = {
  stage: 'finding-direction', skills: ['spreadsheets'], deliverability: 'Synthetic spreadsheet task',
  reachableBuyers: ['synthetic professional group'], geography: 'US', availableHoursPerWeek: 5,
  incomeNeed: { minorUnits: '100', currency: 'USD', scale: 2, basis: 'observed', includedExpenses: [], excludedExpenses: ['tax'] },
  incomeDeadline: null,
  spendingTolerance: { minorUnits: '100', currency: 'USD', scale: 2, basis: 'observed', includedExpenses: [], excludedExpenses: ['tax'] },
  preferences: [], qualifications: [], unknowns: ['income deadline'],
};
const setup = [
  { action: 'saveProfile', requestId: 'host-profile', profileId: 'HOST-P', expectedVersion: 0, profile },
  { action: 'createJourney', requestId: 'host-journey', journeyId: 'HOST-J', expectedVersion: 0, profileId: 'HOST-P', profileVersion: 1, priorLearning: [] },
];
const resume = { action: 'resumeJourney', journeyId: 'HOST-J' };

function fail(message) { process.stderr.write(`prepare-host-smoke: ${message}\n`); process.exit(1); }

function parseDir(args) {
  if (args.length !== 2 || args[0] !== '--dir' || !args[1]) fail('usage: --dir <absolute directory>');
  const dir = args[1];
  if (!isAbsolute(dir) || /^[/\\]{2}/.test(dir)) fail('--dir must be an absolute local path');
  return dir;
}

/** Real read-only CLI child, argument array, no shell; bounded wall time. */
function runCli(cliPath, store, command) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, '--store', store, '--capabilities', 'read'], {
      shell: false, stdio: 'pipe', env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI exceeded deadline')); }, CLI_DEADLINE_MS);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdin.on('error', () => {});
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    child.stdin.end(JSON.stringify(command));
  });
}

if (process.version !== PINNED) fail(`Node ${PINNED} is required; found ${process.version}.`);
const dir = parseDir(process.argv.slice(2));
const storePath = join(dir, 'fixtures.sqlite');
const expectedPath = join(dir, 'expected-resume.json');
for (const path of [storePath, `${storePath}-wal`, `${storePath}-shm`, expectedPath]) {
  if (existsSync(path)) fail(`refusing to overwrite existing ${path}`);
}
const cliPath = fileURLToPath(new URL('../dist/src/interfaces/cli.js', import.meta.url));
const mcpPath = fileURLToPath(new URL('../dist/src/interfaces/mcp.js', import.meta.url));
const clientUrl = new URL('../dist/src/adapters/sqlite/client.js', import.meta.url);
if (!existsSync(cliPath) || !existsSync(mcpPath) || !existsSync(fileURLToPath(clientUrl))) fail('compiled output missing; run `npm run build` first');

await mkdir(dir, { recursive: true });
const { SqliteStorage } = await import(clientUrl.href);
const store = await SqliteStorage.open(storePath, ['read', 'fixture-write']);
let expected;
try {
  for (const command of setup) {
    const result = await store.dispatch(JSON.stringify(command));
    assert.equal(result.status, 'ok', `${command.action} failed: ${JSON.stringify(result)}`);
  }
  expected = await store.dispatch(JSON.stringify(resume));
  assert.equal(expected.status, 'ok', `resumeJourney failed: ${JSON.stringify(expected)}`);
} finally { await store.close(); }

const cli = await runCli(cliPath, storePath, resume);
assert.equal(cli.stderr, '', 'CLI wrote to stderr');
assert.equal(cli.code, 0, `CLI exited ${cli.code}`);
assert.deepEqual(JSON.parse(cli.stdout), expected, 'read-only CLI result differs from storage result');
await writeFile(expectedPath, JSON.stringify(expected, null, 2) + '\n', { flag: 'wx' });
const sha256 = createHash('sha256').update(await readFile(storePath)).digest('hex');

const entry = {
  mcpServers: {
    'market-mommy-fixture-read-only': {
      command: process.execPath,
      args: [mcpPath, '--store', storePath, '--capabilities', 'read'],
      enabled: true, shared: false, timeout: 30000,
    },
  },
};
process.stdout.write([
  `Prepared synthetic HOST-J in ${dir}; storage and real read-only CLI resumeJourney results match.`,
  `fixtures.sqlite sha256 (record before the host session): ${sha256}`,
  'Git-ignored .gg/mcp.json entry (not written; add it yourself only with approval):',
  JSON.stringify(entry, null, 2),
  'The GG Coder host call itself is a separate manual step; see docs/operations.md.',
  '',
].join('\n'));
