import { DatabaseSync } from 'node:sqlite';
import { migrate, migrations } from '../../src/adapters/sqlite/migrate.js';

// Test-owned child: pause inside an actual migration transaction until killed.
class PausedDatabase extends DatabaseSync {
  override exec(sql: string): void {
    super.exec(sql);
    if (sql.includes('CREATE TABLE interrupted_migration')) {
      process.send?.({ state: 'uncommitted' });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    }
  }
}
const path = process.argv[2];
if (!path) throw new Error('Fixture path required');
const db = new PausedDatabase(path, { timeout: 1000, enableForeignKeyConstraints: true });
db.exec('PRAGMA journal_mode=WAL');
await migrate(db, path, [...migrations, { version: 6, name: 'interrupted.sql', sql: 'CREATE TABLE interrupted_migration (id INTEGER PRIMARY KEY) STRICT;' }]);
db.close();
