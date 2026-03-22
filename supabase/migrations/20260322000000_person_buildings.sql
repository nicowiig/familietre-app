-- person_buildings: arkitektoniske verk knyttet til en person
CREATE TABLE IF NOT EXISTS person_buildings (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  person_id     text NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  name          text NOT NULL,
  location_name text,
  city          text,
  country       text DEFAULT 'Norge',
  lat           numeric(10,6),
  lng           numeric(10,6),
  year_built    text,
  description   text,
  image_path    text,   -- storage path i person-photos bucket
  source        text,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE person_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"
  ON person_buildings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admin write"
  ON person_buildings FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
