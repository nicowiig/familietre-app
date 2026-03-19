-- person_media: generelle illustrasjoner og bilder knyttet til biografi
-- Skiller seg fra person_photos (portrett/foto av personen) ved at disse
-- bildene er kontekstuelt relevante for biografien, men ikke nødvendigvis
-- viser personen selv. Eksempler: patenttegninger, kart, avisutklipp,
-- dokumenter, bygninger, gjenstander.

CREATE TABLE person_media (
    id              SERIAL PRIMARY KEY,
    person_id       TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    caption         TEXT,
    category        TEXT DEFAULT 'other',
    -- kategori-verdier: 'patent' | 'document' | 'map' | 'newspaper' | 'photo_related' | 'other'
    display_order   INTEGER DEFAULT 0,
    source_id       INTEGER REFERENCES person_sources(id) ON DELETE SET NULL,
    date_text       TEXT,   -- visningsdato, f.eks. "1932" eller "ca. 1920–1930"
    added_by        TEXT,
    added_date      DATE DEFAULT CURRENT_DATE,
    notes           TEXT
);

CREATE INDEX idx_person_media_person_id ON person_media(person_id);
CREATE INDEX idx_person_media_order     ON person_media(person_id, display_order);

-- RLS
ALTER TABLE person_media ENABLE ROW LEVEL SECURITY;

-- Innloggede brukere kan se alle
CREATE POLICY "person_media_select" ON person_media
    FOR SELECT USING (auth.role() = 'authenticated');

-- Kun service role kan skrive
CREATE POLICY "person_media_insert" ON person_media
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "person_media_update" ON person_media
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "person_media_delete" ON person_media
    FOR DELETE USING (auth.role() = 'service_role');
