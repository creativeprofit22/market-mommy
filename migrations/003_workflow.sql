CREATE TABLE workflow_attempts (
 job_id TEXT PRIMARY KEY NOT NULL REFERENCES record_identities(id),
 journey_id TEXT NOT NULL REFERENCES record_identities(id),
 root_job_id TEXT NOT NULL REFERENCES workflow_attempts(job_id) DEFERRABLE INITIALLY DEFERRED,
 attempt_id TEXT NOT NULL UNIQUE,
 preceding_attempt_id TEXT UNIQUE REFERENCES workflow_attempts(attempt_id),
 request_id TEXT NOT NULL UNIQUE
) STRICT;
CREATE TABLE workflow_ledger (
 sequence INTEGER PRIMARY KEY,
 event_id TEXT NOT NULL UNIQUE,
 job_id TEXT NOT NULL REFERENCES workflow_attempts(job_id),
 actual INTEGER NOT NULL CHECK(actual BETWEEN 0 AND 25),
 reserved INTEGER NOT NULL CHECK(reserved BETWEEN 0 AND 25),
 unknown INTEGER NOT NULL CHECK(unknown BETWEEN 0 AND reserved),
 provider_request_id TEXT,
 created_at TEXT NOT NULL,
 CHECK(actual + reserved <= 25)
) STRICT;
CREATE TABLE workflow_claim (
 slot INTEGER PRIMARY KEY CHECK(slot=1),
 fence INTEGER NOT NULL CHECK(fence>=0),
 job_id TEXT UNIQUE REFERENCES workflow_attempts(job_id),
 owner_id TEXT,
 expires_at TEXT,
 CHECK((job_id IS NULL AND owner_id IS NULL AND expires_at IS NULL) OR (job_id IS NOT NULL AND owner_id IS NOT NULL AND expires_at IS NOT NULL))
) STRICT;
INSERT INTO workflow_claim VALUES(1,0,NULL,NULL,NULL);
CREATE TABLE workflow_receipts (
 request_id TEXT PRIMARY KEY NOT NULL,
 semantic TEXT NOT NULL CHECK(json_valid(semantic)),
 result TEXT NOT NULL CHECK(json_valid(result))
) STRICT;
CREATE TRIGGER workflow_attempts_immutable BEFORE UPDATE ON workflow_attempts BEGIN SELECT RAISE(ABORT,'immutable attempt'); END;
CREATE TRIGGER workflow_attempts_no_delete BEFORE DELETE ON workflow_attempts BEGIN SELECT RAISE(ABORT,'immutable attempt'); END;
CREATE TRIGGER workflow_ledger_immutable BEFORE UPDATE ON workflow_ledger BEGIN SELECT RAISE(ABORT,'append ledger correction'); END;
CREATE TRIGGER workflow_ledger_no_delete BEFORE DELETE ON workflow_ledger BEGIN SELECT RAISE(ABORT,'append ledger correction'); END;
CREATE TRIGGER workflow_receipts_immutable BEFORE UPDATE ON workflow_receipts BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
CREATE TRIGGER workflow_receipts_no_delete BEFORE DELETE ON workflow_receipts BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
