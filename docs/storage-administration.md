# Internal fixture storage administration (step 9)

`SqliteStorage.administer(request): Promise<AdministrationResult>` is an async worker-owned administrative port, not a CLI command, MCP tool, or model capability. Trusted startup grants `read` for backup/export and `fixture-write` for removal, reapplication and new-destination restore/import. No caller confirmation field grants authority.

Requests:

- `{ action: 'backup', destination }`: Node `node:sqlite` `backup(db, destination)`, exclusive new local file, integrity/FK and semantic validation. The completed SQLite file must be a regular file no larger than 16 MiB, matching the restore input bound, before success is reported. Oversized backups reject with `validation` and remove only the owned failed artifact, leaving the source untouched. Save the returned checksum for restore.
- `{ action: 'export', destination }`: bounded version-1 semantic JSON (schema 5), exclusive new file.
- `{ action: 'exportRemovalLedger', destination }`: separate authoritative removal artifact, including source-store identity, ledger version and checksum. Export before and after administrative removals; retain the newest ledger outside old backups.
- `{ action: 'removeFixtures', recordIds }`: at most 64 fixture content identities; Journey/job container deletion is denied. Dependents' content is hidden transitively, rather than returned as usable derived outputs. Accounting, job attempts, workload membership and version identities remain.
- `{ action: 'reapplyRemovalLedger', ledger }`: idempotent union/reapplication; conflicting or older ledger entries fail closed.
- `{ action: 'import', source, destination, ledger }`: semantic import to an exclusively created destination; ledger is mandatory, even when empty.
- `{ action: 'restoreBackup', source, destination, ledger, checksum }`: validates the original backup's returned semantic checksum and applied migration checksums, then restores its validated semantic contents to a new destination. Never copies a raw WAL main file or replaces a store.

Paths must be absolute local paths. Artifact JSON and completed backup output/input files are capped at 16 MiB; tables at 10,000 rows each. SQLite physical size and semantic JSON size are separate limits: semantic export remains available when its JSON fits, even if a SQLite backup is too large. Results include artifact ID, source-store ID, schema/ledger versions, checksum, completion time, elapsed milliseconds and verification status. No paths or payloads are included in error messages.

Removed record-version JSON contains only `id`, `version`, `createdAt`, and `removed: true`; domain reads hide it. For safety, removal sanitizes **all existing** request/worker receipts and framework results, retaining every used request key as permanently blocked. This deliberately sacrifices unrelated old result replay rather than risk retaining copied removed content. Jobs cannot settle a new content result if their recorded inputs were removed. This is fixture retention, not a real-data privacy policy or secure-erasure claim (SQLite free pages and old backup files may retain bytes).

Checksums detect corruption, **not authenticity**. The trusted local administrator is responsible for selecting the latest authoritative ledger; an old copy cannot independently discover removals that happened after it was taken. Store-identity/version/checksum checks cannot prove the supplied ledger is globally newest. Recovery does not execute jobs; stored uncertain states and accounting are carried through. Normal subsequent worker startup retains its existing expired-job quarantine behavior.

Historical verification at implementation handoff: pinned Node 24.21.0 `npm run typecheck` and `npm run build` passed. Final checksum-required restore and removed-input guards were added afterwards; the parent owns the requested full on-disk tests and final recompile. No new recovery runtime exercises or timing claims have been made here. Existing migrations 001–004 and all tests were left unchanged.

## Backup-size regression verification (2026-09-19)

**RUNTIME — Windows, Node 24.21.0, disposable synthetic files only.** Public `SqliteStorage.append` in batches of at most 32 loaded 5,000 standalone observations with 2,000-character statements. Semantic snapshot: 13,002,003 bytes; independently measured SQLite backup: 21,270,528 bytes; bound: 16,777,216 bytes. Before the fix, the regression failed with “Missing expected rejection” because backup succeeded. After the fix, backup rejected with `validation`, left no failed artifact or new sidecars, and preserved source-store identity, ledger version, every exported table and readable sample records. Semantic export still succeeded.

The administration integration suite passed all 10 tests, including an actual small-artifact restore using the returned checksum and authoritative removal ledger (reported restore duration: 37.53 ms), exact restored-table comparison, tampered-checksum rejection, removal-ledger recovery and existing-destination preservation for backup/restore/import. `npm run build`, `node --test dist/tests/integration/administration.test.js`, `npm run typecheck` and `npm run check:boundaries` passed. This local fixture drill is not a real-data recovery guarantee or a hosted/Linux test result. No migrations or dependencies changed.
