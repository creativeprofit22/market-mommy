CREATE TABLE store_metadata (
 slot INTEGER PRIMARY KEY CHECK(slot=1),
 store_id TEXT NOT NULL UNIQUE,
 ledger_version INTEGER NOT NULL CHECK(ledger_version>=0)
) STRICT;
INSERT INTO store_metadata VALUES(1,lower(hex(randomblob(16))),0);
CREATE TABLE removal_ledger (
 record_id TEXT PRIMARY KEY NOT NULL,
 removed_at TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason='explicit-fixture-removal')
) STRICT;
INSERT INTO removal_ledger SELECT * FROM removal_tombstones;
UPDATE store_metadata SET ledger_version=(SELECT count(*) FROM removal_ledger);
CREATE TABLE blocked_receipts (request_id TEXT PRIMARY KEY NOT NULL) STRICT;
DROP TRIGGER record_versions_immutable;
CREATE TRIGGER record_versions_immutable BEFORE UPDATE ON record_versions
WHEN NOT (NEW.id=OLD.id AND NEW.kind=OLD.kind AND NEW.version=OLD.version AND NEW.created_at=OLD.created_at
 AND EXISTS(SELECT 1 FROM removal_tombstones WHERE record_id=OLD.id)
 AND NEW.payload=json_object('id',OLD.id,'version',OLD.version,'createdAt',OLD.created_at,'removed',json('true')))
BEGIN SELECT RAISE(ABORT,'append versions instead'); END;
DROP TRIGGER workflow_receipts_immutable;
CREATE TRIGGER workflow_receipts_immutable BEFORE UPDATE ON workflow_receipts
WHEN NOT (NEW.request_id=OLD.request_id AND NEW.semantic='null' AND NEW.result='null' AND EXISTS(SELECT 1 FROM blocked_receipts WHERE request_id=OLD.request_id))
BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
DROP TRIGGER workflow_results_immutable;
CREATE TRIGGER workflow_results_immutable BEFORE UPDATE ON workflow_results
WHEN NOT (NEW.job_id=OLD.job_id AND NEW.fence=OLD.fence AND NEW.result='null' AND EXISTS(SELECT 1 FROM removal_ledger))
BEGIN SELECT RAISE(ABORT,'immutable result'); END;
