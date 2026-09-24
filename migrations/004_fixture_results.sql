CREATE TABLE workflow_results (
 job_id TEXT PRIMARY KEY NOT NULL REFERENCES workflow_attempts(job_id),
 fence INTEGER NOT NULL CHECK(fence > 0),
 result TEXT NOT NULL CHECK(json_valid(result) AND length(CAST(result AS BLOB)) <= 65536)
) STRICT;
CREATE TRIGGER workflow_results_immutable BEFORE UPDATE ON workflow_results BEGIN SELECT RAISE(ABORT,'immutable result'); END;
CREATE TRIGGER workflow_results_no_delete BEFORE DELETE ON workflow_results BEGIN SELECT RAISE(ABORT,'immutable result'); END;
