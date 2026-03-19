-- ============================================================
-- MIGRASJON: Normalisert adressestruktur
-- Dato: 2026-03-13
-- Krav: REQ-ADR24–29
--
-- Oppretter:
--   1. addresses          — kanonisk adresseregister
--   2. address_periods    — kobling person/familie/org ↔ adresse + periode
--
-- Beholder person_addresses inntil migrering er verifisert.
-- ============================================================


-- ============================================================
-- 1. ADDRESSES — kanonisk adresseregister
-- ============================================================

CREATE TABLE addresses (
    id                  SERIAL PRIMARY KEY,

    -- Adresselinje (lag 2 — kun når kjent)
    street_name         TEXT,
    house_number        INTEGER,        -- heltall for korrekt sortering (5, 6, 7)
    house_letter        TEXT,           -- bokstavdel skilt ut: "B", "C"
    floor               TEXT,           -- "3. etg.", "st.", "kj."

    -- Postalt (moderne — tomt for historiske adresser)
    postal_code         TEXT,
    postal_town         TEXT,           -- slik posten bruker det: "BERGEN"

    -- Geografisk hierarki (lag 1 — Nominatim-alignet)
    locality            TEXT,           -- bydel/suburb: "Sandviken", "Nordnes"
    city                TEXT,           -- by: "Bergen", "Oslo", "København"
    municipality        TEXT,           -- kommune: "Bergen", "Øygarden"
    county              TEXT,           -- fylke slik det het DA personen bodde der:
                                        --   "Søndre Bergenhus amt" (–1919)
                                        --   "Hordaland" (1919–2020)
                                        --   "Vestland" (2020–)
    country             TEXT,           -- alltid norsk form: "Norge", "Danmark", "Tyskland"
    country_code        TEXT,           -- ISO 3166-1 alpha-2: "NO", "DK", "DE"

    -- Historisk kontekst
    historical_region   TEXT,           -- pre-moderne politiske enheter:
                                        --   "Holstein", "Preussen", "HRR"
    historical_name     TEXT,           -- gammel stavemåte av gaten: "Wolffsgade"
    bergen_rode         TEXT,           -- "Rode 4, nr. 12" (Bergen Byarkiv)

    -- Rå kildetekst (bevares alltid — REQ-PLC06)
    place_raw           TEXT,

    -- Geocoding — universelt (kompatibelt med alle karttjenester via lat/lng)
    coordinates_lat     FLOAT,
    coordinates_lng     FLOAT,
    bbox_north          FLOAT,          -- bounding box for riktig zoom på kart
    bbox_south          FLOAT,
    bbox_east           FLOAT,
    bbox_west           FLOAT,

    -- Service-ID-er (cache — unngår re-geocoding)
    kartverket_id       TEXT,           -- Kartverkets adressekode (norske adresser)
    osm_id              BIGINT,         -- OpenStreetMap node/way/relation ID
    osm_type            TEXT,           -- "node" | "way" | "relation"

    -- Cachet visningsstreng (fra geocoding-tjeneste)
    display_name        TEXT,           -- "Seiersbjerget 8, Bergen, Norge"

    -- Presisjonsnivå (REQ-ADR25)
    -- Styrer visning: Maps-lenke kun for full_address/street
    granularity         TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (granularity IN (
                            'full_address',  -- gate + nummer kjent
                            'street',        -- gate kjent, nummer ukjent
                            'locality',      -- bydel/suburb
                            'city',          -- by kjent
                            'county',        -- fylke/amt kjent
                            'country',       -- kun land kjent
                            'unknown'        -- ingenting registrert
                        )),

    -- Datakvalitet
    is_verified         BOOLEAN DEFAULT FALSE,  -- bekreftet via Kartverket/Nominatim/manuelt
    needs_review        BOOLEAN DEFAULT FALSE,  -- flagget for manuell gjennomgang

    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE addresses IS
    'Kanonisk adresseregister. Én rad per unik adresse. '
    'Kobles til personer/familier/org via address_periods. REQ-ADR24.';

COMMENT ON COLUMN addresses.granularity IS
    'Presisjonsnivå. Styrer visning: Maps-lenke kun for full_address og street. REQ-ADR25.';

COMMENT ON COLUMN addresses.county IS
    'Fylke/amt slik det het DA personen bodde der. '
    'Bevarer historisk administrativ kontekst — ikke normalisert til dagens navn.';

COMMENT ON COLUMN addresses.historical_region IS
    'Pre-moderne politiske enheter uten moderne ekvivalent: Holstein, Preussen, HRR. '
    'Brukes der country/county ikke dekker den historiske politiske konteksten.';

COMMENT ON COLUMN addresses.place_raw IS
    'Rå kildetekst fra GEDCOM/import. Bevares alltid (REQ-PLC06). '
    'Brukes som input til AI-parsing og for sporbarhet.';

COMMENT ON COLUMN addresses.coordinates_lat IS
    'Geocoordinater er universell valuta — kompatibel med Google Maps, '
    'OpenStreetMap, Kartverket, Mapbox, Leaflet og alle andre karttjenester.';


-- ============================================================
-- 2. ADDRESS_PERIODS — kobling entitet ↔ adresse + periode
-- ============================================================

CREATE TABLE address_periods (
    id              SERIAL PRIMARY KEY,
    address_id      INTEGER NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,

    -- Entitet (polymorfisk — REQ-ADR29)
    entity_type     TEXT NOT NULL
                    CHECK (entity_type IN ('person', 'family', 'organization')),
    entity_id       TEXT NOT NULL,      -- person_id, family_id, org_id

    -- Type tilknytning
    period_type     TEXT NOT NULL
                    CHECK (period_type IN (
                        'residence',        -- bosted
                        'ownership',        -- eierskap (familie/org)
                        'workplace',        -- arbeidsplass
                        'childhood_home',   -- barndomshjem
                        'student_housing',  -- studentbolig
                        'summer_home',      -- sommerhus
                        'census_record',    -- folktelling (read-only)
                        'other'
                    )),

    -- Periode
    date_from       TEXT,               -- "1897-06-15", "1909", "1897-06" støttes
    date_to         TEXT,
    is_current      BOOLEAN DEFAULT FALSE,

    -- Arbeidsplass-felt (REQ-ADR06)
    employer        TEXT,
    department      TEXT,

    -- Metadata
    notes           TEXT,
    source_type     TEXT,               -- "gedcom" | "manual" | "census" | "ai_parsed"
    is_readonly     BOOLEAN DEFAULT FALSE,  -- census/GEDCOM: ikke redigerbar av bruker (REQ-ADR18)
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE address_periods IS
    'Kobler person, familie eller organisasjon til en adresse med periode og type. '
    'Erstatter person_addresses. REQ-ADR24, REQ-ADR29.';

COMMENT ON COLUMN address_periods.entity_type IS
    'Polymorfisk kobling: person | family | organization. REQ-ADR29.';

COMMENT ON COLUMN address_periods.is_readonly IS
    'TRUE for data fra GEDCOM-import og census — ikke redigerbar av vanlige brukere. REQ-ADR18.';


-- ============================================================
-- INDEKSER
-- ============================================================

-- address_periods — vanligste spørringer
CREATE INDEX idx_address_periods_entity
    ON address_periods (entity_type, entity_id);

CREATE INDEX idx_address_periods_address
    ON address_periods (address_id);

CREATE INDEX idx_address_periods_person
    ON address_periods (entity_id)
    WHERE entity_type = 'person';

-- addresses — søk og oppslag
CREATE INDEX idx_addresses_city
    ON addresses (city);

CREATE INDEX idx_addresses_country_code
    ON addresses (country_code);

CREATE INDEX idx_addresses_granularity
    ON addresses (granularity);

CREATE INDEX idx_addresses_kartverket
    ON addresses (kartverket_id)
    WHERE kartverket_id IS NOT NULL;

CREATE INDEX idx_addresses_osm
    ON addresses (osm_id)
    WHERE osm_id IS NOT NULL;

-- Geografisk nærhetssøk (krever PostGIS eller manuell bounding box)
CREATE INDEX idx_addresses_coordinates
    ON addresses (coordinates_lat, coordinates_lng)
    WHERE coordinates_lat IS NOT NULL;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_periods ENABLE ROW LEVEL SECURITY;

-- Innloggede brukere kan lese alt
CREATE POLICY "addresses_read_authenticated"
    ON addresses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "address_periods_read_authenticated"
    ON address_periods FOR SELECT
    TO authenticated
    USING (true);

-- Kun service_role kan skrive (admin + migrering)
CREATE POLICY "addresses_write_service"
    ON addresses FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "address_periods_write_service"
    ON address_periods FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- OPPDATER REFERANSE I person_work_experience
-- Legger til ny FK ved siden av gammel (begge nullable i overgangsperiode)
-- ============================================================

ALTER TABLE person_work_experience
    ADD COLUMN address_period_id INTEGER REFERENCES address_periods(id) ON DELETE SET NULL;

COMMENT ON COLUMN person_work_experience.address_period_id IS
    'Peker på address_periods. Erstatter address_id (person_addresses) når migrering er ferdig.';


-- ============================================================
-- UPDATED_AT trigger for addresses
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER addresses_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
