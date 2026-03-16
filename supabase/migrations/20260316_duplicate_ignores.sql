-- Tabell for avviste duplikatpar
-- Par lagres normalisert (person_id_a < person_id_b) for å unngå dobbeltlagring
CREATE TABLE IF NOT EXISTS duplicate_ignores (
  id            bigserial PRIMARY KEY,
  person_id_a   text NOT NULL,
  person_id_b   text NOT NULL,
  ignored_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id_a, person_id_b)
);

-- Indeks for raske oppslag
CREATE INDEX IF NOT EXISTS duplicate_ignores_a_idx ON duplicate_ignores (person_id_a);
CREATE INDEX IF NOT EXISTS duplicate_ignores_b_idx ON duplicate_ignores (person_id_b);

-- RLS: alle innloggede brukere kan lese og skrive
ALTER TABLE duplicate_ignores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Innloggede kan lese ignorerte par"
  ON duplicate_ignores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Innloggede kan legge til ignorerte par"
  ON duplicate_ignores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Innloggede kan slette egne ignorerte par"
  ON duplicate_ignores FOR DELETE
  TO authenticated
  USING (ignored_by = auth.uid() OR ignored_by IS NULL);
