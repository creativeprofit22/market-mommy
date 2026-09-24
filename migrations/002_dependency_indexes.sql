CREATE INDEX record_dependencies_by_source ON record_dependencies(dependency_id, dependency_version);
CREATE INDEX record_identities_by_journey ON record_identities(journey_id, kind);
