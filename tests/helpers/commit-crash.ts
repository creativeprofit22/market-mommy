import { DatabaseSync } from 'node:sqlite';
import { dispatchTransaction } from '../../src/adapters/sqlite/unit-of-work.js';
import { workflowTransaction } from '../../src/adapters/sqlite/workflow.js';
import { createTrustedContext } from '../../src/application/authorization.js';

const [path, operation, edge, json] = process.argv.slice(2);
if (!path || !json || !['intent', 'result'].includes(operation!) || !['before', 'after'].includes(edge!)) throw new Error('Invalid crash fixture');
class PausingDatabase extends DatabaseSync {
  armed = false;
  commits = 0;
  override exec(sql: string): void {
    // workflowTransaction first commits recovery separately; intercept settlement only.
    const target = this.armed && sql === 'COMMIT' && ++this.commits === (operation === 'result' ? 2 : 1);
    if (target && edge === 'before') this.pause();
    super.exec(sql);
    if (target && edge === 'after') this.pause();
  }
  pause(): never {
    process.send!({ state: 'paused', operation, edge });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    throw new Error('Unexpected resume');
  }
}
const db = new PausingDatabase(path);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
const context = createTrustedContext(['read', 'fixture-write', 'fixture-run', 'cancel']);
db.armed = true;
const result = operation === 'intent' ? dispatchTransaction(db, json, context) : workflowTransaction(db, JSON.parse(json), context);
process.send!({ state: 'unexpected-return', result });
db.close();
