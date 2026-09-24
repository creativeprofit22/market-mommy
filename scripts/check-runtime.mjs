import { readFileSync } from 'node:fs';

const expected = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim();
if (process.versions.node !== expected) {
  console.error(`Node ${expected} is required; found ${process.versions.node}. Select the pinned runtime without changing other projects.`);
  process.exitCode = 1;
}
