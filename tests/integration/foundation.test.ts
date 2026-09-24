import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Agent, agentLoop } from '@kenkaiiii/gg-agent';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { FOUNDATION_FORMAT_VERSION } from '../../src/version.js';

const root = new URL('../../../', import.meta.url);
test('pinned runtime, format and installed public exports are available', () => {
  assert.equal(process.versions.node, readFileSync(new URL('.node-version', root), 'utf8').trim());
  assert.equal(FOUNDATION_FORMAT_VERSION, 1);
  assert.equal(typeof Agent, 'function');
  assert.equal(typeof agentLoop, 'function');
  assert.equal(typeof McpServer, 'function');
  assert.equal(typeof StdioServerTransport, 'function');
});

test('the actual source tree respects inward import boundaries', () => {
  const output = execFileSync(process.execPath, ['scripts/check-boundaries.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /Import boundaries passed/);
});
