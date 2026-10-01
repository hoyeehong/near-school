-- Cloud SQL built-in users also receive direct CREATEDB/CREATEROLE attributes.
-- Revoking cloudsqlsuperuser membership alone does not remove those attributes.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nearschool_runtime') THEN
    EXECUTE 'ALTER ROLE nearschool_runtime NOCREATEDB NOCREATEROLE';
  END IF;
END $$;
