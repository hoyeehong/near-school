CREATE TABLE housing_projects (
 id text PRIMARY KEY, name text NOT NULL, address text NOT NULL, kind text NOT NULL CHECK (kind IN ('private','hdb')),
 location geography(Point,4326), source_url text NOT NULL, refreshed_at timestamptz NOT NULL
);
CREATE INDEX housing_location_idx ON housing_projects USING gist(location);
CREATE TABLE housing_transactions (
 id text PRIMARY KEY, project_id text NOT NULL REFERENCES housing_projects(id) ON DELETE CASCADE,
 month date NOT NULL, price numeric NOT NULL CHECK(price>0), area numeric NOT NULL CHECK(area>0),
 property_type text NOT NULL, area_type text NOT NULL, tenure text NOT NULL, sale_type text NOT NULL,
 floor_range text NOT NULL, units integer NOT NULL CHECK(units>0)
);
CREATE INDEX housing_transaction_project_idx ON housing_transactions(project_id,month DESC);
CREATE INDEX housing_transaction_month_idx ON housing_transactions(month DESC);
CREATE TABLE housing_refreshes (source text PRIMARY KEY, refreshed_at timestamptz NOT NULL, projects integer NOT NULL, transactions integer NOT NULL);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nearschool_runtime') THEN
  GRANT SELECT ON housing_projects,housing_transactions,housing_refreshes TO nearschool_runtime;
 END IF;
END $$;
CREATE TABLE housing_geocodes(address text PRIMARY KEY,coordinates jsonb NOT NULL,verified_at timestamptz NOT NULL DEFAULT now());
