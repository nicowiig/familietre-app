-- ============================================================
-- MIGRASJON: Place Articles — steder, bygninger og historiske artikler
-- Dato: 2026-03-14
--
-- Oppretter:
--   1. Nye kolonner på addresses (building_name, building_year_built, building_architect)
--   2. place_articles        — artikkel per sted/bygning
--   3. place_article_images  — bilder knyttet til artikkel
--   4. place_article_persons — koblinger mellom artikkel og person
--   5. place_article_sources — kildereferanser per artikkel
-- ============================================================


-- ============================================================
-- 1. NYE KOLONNER PÅ addresses
-- ============================================================

ALTER TABLE addresses
  ADD COLUMN building_name        TEXT,
  ADD COLUMN building_year_built  TEXT,     -- "ca. 1650", "1776", "1933"
  ADD COLUMN building_architect   TEXT;

COMMENT ON COLUMN addresses.building_name IS
  'Bygningens navn/kallenavn: "Bauckgården", "Torvet 13", "Villa Framnes"';

COMMENT ON COLUMN addresses.building_year_built IS
  'Byggeår (fritekst for å støtte "ca. 1650" og usikre årstall)';

COMMENT ON COLUMN addresses.building_architect IS
  'Arkitekt eller byggherre, der kjent';


-- ============================================================
-- 2. place_articles — artikkel per sted eller bygning
-- ============================================================

CREATE TABLE place_articles (
  id               SERIAL PRIMARY KEY,

  -- Kobling til kanonisk adresse (valgfri — noen artikler dekker byer/regioner)
  address_id       INTEGER REFERENCES addresses(id) ON DELETE SET NULL,

  -- Innhold
  title            TEXT NOT NULL,
  subtitle         TEXT,
  body             TEXT,           -- Markdown
  article_type     TEXT NOT NULL DEFAULT 'building'
                   CHECK (article_type IN (
                     'building',
                     'street',
                     'neighborhood',
                     'city',
                     'region',
                     'estate',
                     'institution'
                   )),

  -- Geografisk kontekst (for artikler uten spesifikk address_id)
  locality         TEXT,
  city             TEXT,
  country          TEXT,

  -- Historisk periode artikkelen dekker
  period_from      TEXT,
  period_to        TEXT,

  -- Forsidebilde (storage-path i person-photos bucket)
  cover_image_path TEXT,

  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE place_articles IS
  'Artikler om steder, bygninger og historiske lokaliteter. '
  'Kan knyttes til en kanonisk adresse (address_id) eller stå alene (by, region).';

COMMENT ON COLUMN place_articles.body IS
  'Brødtekst i Markdown. Rendres i PlacePage.';

COMMENT ON COLUMN place_articles.cover_image_path IS
  'Storage-path i person-photos bucket, f.eks. places/prinsens-gate-61-bauckgarden-1898.jpg';


-- ============================================================
-- 3. place_article_images — bilder knyttet til artikkel
-- ============================================================

CREATE TABLE place_article_images (
  id           SERIAL PRIMARY KEY,
  article_id   INTEGER NOT NULL REFERENCES place_articles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,     -- storage-path i person-photos bucket
  caption      TEXT,
  year         TEXT,
  creator      TEXT,              -- fotograf / tegner
  source_url   TEXT,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE place_article_images IS
  'Bilder, tegninger og kart knyttet til en place_article. '
  'storage_path brukes på samme måte som drive_url i person_photos.';


-- ============================================================
-- 4. place_article_persons — koblinger mellom artikkel og person
-- ============================================================

CREATE TABLE place_article_persons (
  id          SERIAL PRIMARY KEY,
  article_id  INTEGER NOT NULL REFERENCES place_articles(id) ON DELETE CASCADE,
  person_id   TEXT NOT NULL,
  role_note   TEXT,               -- "Vokste opp her", "Hadde kontor her", "Bodde her 1840–1860"
  UNIQUE(article_id, person_id)
);

COMMENT ON TABLE place_article_persons IS
  'Kobler en place_article til én eller flere personer i familietre-databasen. '
  'role_note beskriver personens tilknytning til stedet.';


-- ============================================================
-- 5. place_article_sources — kildereferanser per artikkel
-- ============================================================

CREATE TABLE place_article_sources (
  id          SERIAL PRIMARY KEY,
  article_id  INTEGER NOT NULL REFERENCES place_articles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT,
  year        TEXT,
  publisher   TEXT,
  sort_order  INTEGER DEFAULT 0
);

COMMENT ON TABLE place_article_sources IS
  'Kildereferanser for en place_article. Vises i Kilder-seksjonen på PlacePage.';


-- ============================================================
-- INDEKSER
-- ============================================================

CREATE INDEX idx_place_articles_address
  ON place_articles (address_id)
  WHERE address_id IS NOT NULL;

CREATE INDEX idx_place_articles_type
  ON place_articles (article_type);

CREATE INDEX idx_place_article_persons_person
  ON place_article_persons (person_id);

CREATE INDEX idx_place_article_images_article
  ON place_article_images (article_id, sort_order);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE place_articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_article_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_article_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_article_sources ENABLE ROW LEVEL SECURITY;

-- Innloggede brukere kan lese alt
CREATE POLICY "place_articles_read_authenticated"
  ON place_articles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "place_article_images_read_authenticated"
  ON place_article_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "place_article_persons_read_authenticated"
  ON place_article_persons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "place_article_sources_read_authenticated"
  ON place_article_sources FOR SELECT
  TO authenticated
  USING (true);

-- Kun service_role kan skrive (admin + seeding)
CREATE POLICY "place_articles_write_service"
  ON place_articles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "place_article_images_write_service"
  ON place_article_images FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "place_article_persons_write_service"
  ON place_article_persons FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "place_article_sources_write_service"
  ON place_article_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- UPDATED_AT-TRIGGER (gjenbruk eksisterende funksjon)
-- ============================================================

CREATE TRIGGER set_place_articles_updated_at
  BEFORE UPDATE ON place_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
