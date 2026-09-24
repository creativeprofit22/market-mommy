import { SqliteStorage } from '../../src/adapters/sqlite/client.js';

const [path, ownerId] = process.argv.slice(2);
if (!path || !ownerId) throw new Error('Fixture arguments required');
const store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
process.send?.({ state: 'ready' });
process.once('message', async () => {
  try {
    const jobs = await store.workflow({ action: 'claim', ownerId, leaseMs: 120000 });
    process.send?.({ state: 'claimed', jobs });
    // Remain alive until the test kills this exact process, including its SQLite worker.
  } catch (error) { process.send?.({ state: 'error', message: String(error) }); }
});
