-- Local test database has no cloud runtime role; production roles are provisioned by Terraform.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nearschool_runtime') THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cloudsqlsuperuser') THEN
      EXECUTE 'REVOKE cloudsqlsuperuser FROM nearschool_runtime';
    END IF;
    EXECUTE 'GRANT CONNECT ON DATABASE nearschool TO nearschool_runtime';
    EXECUTE 'GRANT USAGE ON SCHEMA public TO nearschool_runtime';
    EXECUTE 'GRANT SELECT ON places, policies, official_distances, dataset_versions TO nearschool_runtime';
    EXECUTE 'GRANT SELECT,INSERT,UPDATE ON ai_budget,request_limits TO nearschool_runtime';
  END IF;
END $$;
