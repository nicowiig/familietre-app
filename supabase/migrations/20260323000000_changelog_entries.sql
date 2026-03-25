-- changelog_entries: app-endringslogg (nye funksjoner, forbedringer, feilrettinger)
CREATE TABLE IF NOT EXISTS changelog_entries (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entry_date  date        NOT NULL DEFAULT current_date,
  entry_type  text        NOT NULL CHECK (entry_type IN ('feature', 'improvement', 'bugfix')),
  title       text        NOT NULL,
  description text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS changelog_entries_date_idx ON changelog_entries(entry_date DESC);

ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"
  ON changelog_entries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admin write"
  ON changelog_entries FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Seed: eksisterende entries
INSERT INTO changelog_entries (entry_date, entry_type, title, description) VALUES
  ('2026-03-22', 'feature',     'Arkitektoniske verk',              'Arkitekter og byggherrer kan nå knyttes til bygninger de har tegnet eller bestilt. Vises med bildekort, kart og lightbox på personprofilen.'),
  ('2026-03-22', 'feature',     'Stedssider',                       'Steder som adresser er koblet til kan ha egne artikler med historikk, bilder og beskrivelse. Klikk "Les mer om…" i adresseblokken på en personprofil.'),
  ('2026-03-20', 'feature',     'Statistikk-side',                  'Ny side med oversikt over fødselssteder, navn, generasjoner og andre mønstre på tvers av hele treet.'),
  ('2026-03-20', 'feature',     'Steder-kart',                      'Alle adresser i arkivet visualisert på ett kart. Klikk på en prikk for å se hvem som bodde der.'),
  ('2026-03-19', 'improvement', 'Karriere og arbeidserfaring slått sammen', 'Roller og arbeidserfaring vises nå i én felles seksjon per person, med tydeligere tidslinje og varighetsberegning.'),
  ('2026-03-16', 'improvement', 'Adresser: normalisert arkitektur', 'Alle adresser er nå lagret i et kanonisk register. Samme adresse kobles til flere personer uten duplisering, og historiske adressenavn bevares.'),
  ('2026-03-14', 'feature',     'Familietre-visualisering',         'Interaktiv trevisning med zoom, etterkommere- og forfedremodus, og støtte for komplekse familiestrukturer.'),
  ('2026-03-12', 'feature',     'Datakvalitet-dashboard',           'Oversikt over hull i arkivet: hvem mangler biografi, bilde, fødselsdato eller adresse. Sortert og filtrerbart.'),
  ('2026-03-11', 'feature',     'Biografi med media',               'Personprofiler støtter nå lengre biografier med innebygde bilder og dokumenter direkte i teksten.'),
  ('2026-03-05', 'feature',     'Familietre lansert',               '2109 personer og 495 familier importert fra GEDCOM. Søk, profiler, slektsgrener og autentisering via Google.');
