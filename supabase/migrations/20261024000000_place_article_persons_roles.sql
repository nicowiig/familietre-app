-- Institusjonssider: personkoblinger med rolle, periode og type.
-- Gjør det mulig å vise en tabell over personer i treet som har jobbet i,
-- eid eller hatt styreverv i en institusjon (Hansa, Wiig & Co …),
-- samt indirekte tilknytninger (f.eks. et oppkjøpt firma).

ALTER TABLE place_article_persons
  ADD COLUMN IF NOT EXISTS relation_type TEXT
    CHECK (relation_type IS NULL OR relation_type IN
      ('grunnlegger', 'eier', 'partner', 'ansatt', 'styreverv', 'indirekte', 'annet')),
  ADD COLUMN IF NOT EXISTS title      TEXT,
  ADD COLUMN IF NOT EXISTS date_from  TEXT,
  ADD COLUMN IF NOT EXISTS date_to    TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN place_article_persons.relation_type IS
  'grunnlegger | eier | partner | ansatt | styreverv | indirekte | annet. Indirekte vises i egen gruppe.';
COMMENT ON COLUMN place_article_persons.title IS
  'Rolle/stilling ved institusjonen, f.eks. «Direksjonsformann», «Advokat».';
COMMENT ON COLUMN place_article_persons.date_from IS 'Fritekst-år, f.eks. «1894» eller «ca. 1875».';
COMMENT ON COLUMN place_article_persons.date_to   IS 'Fritekst-år. Tom = ukjent/pågående.';

-- En person kan ha flere roller i samme institusjon (ansatt, senere partner).
ALTER TABLE place_article_persons
  DROP CONSTRAINT IF EXISTS place_article_persons_article_id_person_id_key;
