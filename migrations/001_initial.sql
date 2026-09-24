CREATE TABLE record_identities (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 80),
  kind TEXT NOT NULL CHECK(kind IN ('profile','observation','evidence','interpretation','recommendation','offer','experiment','outcome','journey','job')),
  journey_id TEXT,
  journey_kind TEXT NOT NULL DEFAULT 'journey' CHECK(journey_kind = 'journey'),
  latest_version INTEGER NOT NULL CHECK(latest_version BETWEEN 1 AND 2147483647),
  UNIQUE(id, kind),
  FOREIGN KEY(journey_id, journey_kind) REFERENCES record_identities(id, kind) ON DELETE RESTRICT,
  FOREIGN KEY(id, latest_version) REFERENCES record_versions(id, version) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE record_versions (
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 2147483647),
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload) AND length(CAST(payload AS BLOB)) <= 262144),
  PRIMARY KEY(id, version),
  FOREIGN KEY(id, kind) REFERENCES record_identities(id, kind) ON DELETE RESTRICT,
  CHECK(json_extract(payload, '$.id') IS id),
  CHECK(json_extract(payload, '$.version') IS version),
  CHECK(json_extract(payload, '$.createdAt') IS created_at)
) STRICT;

CREATE TABLE record_dependencies (
  dependent_id TEXT NOT NULL,
  dependent_version INTEGER NOT NULL,
  dependency_id TEXT NOT NULL,
  dependency_version INTEGER NOT NULL,
  PRIMARY KEY(dependent_id, dependent_version, dependency_id, dependency_version),
  FOREIGN KEY(dependent_id, dependent_version) REFERENCES record_versions(id, version) ON DELETE RESTRICT,
  FOREIGN KEY(dependency_id, dependency_version) REFERENCES record_versions(id, version) ON DELETE RESTRICT
) STRICT;

CREATE TABLE request_receipts (
  request_id TEXT PRIMARY KEY NOT NULL,
  journey_id TEXT REFERENCES record_identities(id) ON DELETE RESTRICT,
  semantic_request TEXT NOT NULL CHECK(json_valid(semantic_request) AND length(CAST(semantic_request AS BLOB)) <= 262144),
  result TEXT NOT NULL CHECK(json_valid(result) AND length(CAST(result AS BLOB)) <= 262144),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE removal_tombstones (
  record_id TEXT PRIMARY KEY NOT NULL REFERENCES record_identities(id) ON DELETE RESTRICT,
  removed_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason = 'explicit-fixture-removal')
) STRICT;

CREATE TRIGGER record_identity_membership_immutable
BEFORE UPDATE OF id, kind, journey_id ON record_identities
BEGIN SELECT RAISE(ABORT, 'immutable record membership'); END;

CREATE TRIGGER record_versions_immutable
BEFORE UPDATE ON record_versions
BEGIN SELECT RAISE(ABORT, 'append versions instead'); END;

CREATE TRIGGER record_versions_no_delete
BEFORE DELETE ON record_versions
BEGIN SELECT RAISE(ABORT, 'use a removal tombstone'); END;
