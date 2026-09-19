CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS places (
  id text PRIMARY KEY, payload jsonb NOT NULL, published boolean NOT NULL DEFAULT false,
  location geography(Point,4326), snapshot_version text NOT NULL
);
CREATE INDEX IF NOT EXISTS places_location_idx ON places USING gist(location);
CREATE TABLE IF NOT EXISTS policies (
  id text PRIMARY KEY, payload jsonb NOT NULL, from_year integer NOT NULL, to_year integer,
  search tsvector NOT NULL, embedding vector(768), embedding_model text
);
CREATE INDEX IF NOT EXISTS policies_search_idx ON policies USING gin(search);
CREATE TABLE IF NOT EXISTS official_distances (
  address_id text NOT NULL, school_id text NOT NULL REFERENCES places(id), exercise_year integer NOT NULL,
  payload jsonb NOT NULL, authorised boolean NOT NULL DEFAULT false,
  PRIMARY KEY(address_id, school_id, exercise_year)
);
CREATE TABLE IF NOT EXISTS ai_budget (month date PRIMARY KEY, reserved_sgd numeric(12,5) NOT NULL CHECK(reserved_sgd>=0));
CREATE TABLE IF NOT EXISTS request_limits (key text NOT NULL, minute timestamptz NOT NULL, count integer NOT NULL, PRIMARY KEY(key,minute));
CREATE TABLE IF NOT EXISTS dataset_versions (version text PRIMARY KEY, published_at timestamptz NOT NULL DEFAULT now(), report jsonb NOT NULL);
