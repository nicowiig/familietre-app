-- ============================================================
-- Steder over tid (del 7) – 21.10.2026
--
-- Et sted har én fast identitet (addresses.id). Navn og statstilhørighet varierer med årstallet:
--   polities             riker/stater med beskrivelse (Danmark-Norge, Det tysk-romerske rike …)
--   place_jurisdictions  hvilket rike et land/en region/et enkeltsted hørte til i en periode
--   place_name_periods   hva et sted het i en periode (Christiania 1624–1877, Breslau –1945 …)
-- Visningen («Kristiania (nå Oslo), den gang unionen Sverige-Norge») beregnes i nettsiden
-- ut fra hendelsens årstall. Ingenting av dette lagres som tekst på hendelsen.
--
-- Oppslagsrekkefølge: enkeltsted (address_id) > land+region > land.
-- Perioder er inklusive årstall; NULL betyr åpen ende.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.polities (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text,
  wikidata_id text
);

CREATE TABLE IF NOT EXISTS public.place_jurisdictions (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country     text,                      -- dagens land, norsk form (addresses.country)
  region      text,                      -- region/fylke (addresses.historical_region eller county); NULL = hele landet
  address_id  integer REFERENCES public.addresses(id) ON DELETE CASCADE,  -- enkeltsted som avviker
  polity_id   integer NOT NULL REFERENCES public.polities(id),
  valid_from  integer,
  valid_to    integer,
  note        text,
  CHECK (address_id IS NOT NULL OR country IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_place_jur_country ON public.place_jurisdictions(country, region);

CREATE TABLE IF NOT EXISTS public.place_name_periods (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  modern_name     text,                  -- by/sted slik det heter i dag (addresses.city / name_short)
  country         text,
  address_id      integer REFERENCES public.addresses(id) ON DELETE CASCADE,
  historical_name text NOT NULL,
  valid_from      integer,
  valid_to        integer,
  note            text,
  CHECK (address_id IS NOT NULL OR modern_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_place_name_periods ON public.place_name_periods(modern_name, country);

ALTER TABLE public.polities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_name_periods  ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['polities','place_jurisdictions','place_name_periods'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (is_approved_user())', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user())', t || '_admin', t);
  END LOOP;
END $$;

-- ---------- Riker
INSERT INTO polities (name, description) VALUES
 ('Kalmarunionen', 'Union mellom Danmark, Norge og Sverige under felles konge (1397–1523).'),
 ('Danmark-Norge', 'Personal- og senere realunion under den danske kongen. For Norge fra 1380, som riksdel fra 1537, til 1814.'),
 ('unionen Sverige-Norge', 'Norge var eget kongerike i union med Sverige, med felles konge og utenrikspolitikk (1814–1905).'),
 ('Norge', NULL), ('Danmark', NULL), ('Sverige', NULL), ('Polen', NULL),
 ('Det tysk-romerske rike', 'Løst forbund av fyrstedømmer, bispedømmer og frie byer under en valgt keiser, til 1806.'),
 ('Det tyske forbund', 'Forbund av tyske stater etter Napoleonskrigene (1815–1866).'),
 ('Det nordtyske forbund', 'Forbundsstat under Preussen (1867–1870), forløperen til Det tyske keiserriket.'),
 ('Det tyske keiserriket', 'Samlet Tyskland under prøyssisk keiser (1871–1918).'),
 ('Keiserriket Østerrike', 'Habsburgernes keiserrike (1804–1867).'),
 ('Østerrike-Ungarn', 'Dobbeltmonarkiet under Habsburg (1867–1918).'),
 ('Kongeriket Ungarn', NULL),
 ('Tsjekkoslovakia', 'Republikk 1918–1992.'),
 ('Polen-Litauen', 'Den polsk-litauiske realunionen (1569–1795).'),
 ('delt mellom Preussen, Russland og Østerrike', 'Polen var oppdelt etter de tre delingene (1795–1918).'),
 ('Storfyrstedømmet Litauen', NULL),
 ('Russland', NULL),
 ('Storfyrstedømmet Finland (Russland)', 'Selvstyrt storfyrstedømme under den russiske tsaren (1809–1917).'),
 ('den böhmiske krone (Habsburg)', 'Schlesien hørte til den böhmiske kronen og fra 1526 til Habsburg (til 1742).'),
 ('Preussen', 'Kongeriket Preussen.'),
 ('Det tyske riket', 'Tyskland fram til 1945.'),
 ('hertugdømmene under den danske kongen', 'Slesvig og Holsten var hertugdømmer med den danske kongen som hertug (1460–1864).'),
 ('De forente Nederlandene', 'Republikken De sju forente Nederlandene (1581–1795).'),
 ('De habsburgske Nederlandene', 'De burgundisk-habsburgske Nederlandene, til republikken 1581.')
ON CONFLICT (name) DO NOTHING;

-- ---------- Tilhørighet (land, region, fra, til, rike)
INSERT INTO place_jurisdictions (country, region, valid_from, valid_to, polity_id, note)
SELECT v.country, v.region, v.f, v.t, p.id, v.note FROM (VALUES
 ('Norge',   NULL, 1397, 1523, 'Kalmarunionen', NULL),
 ('Norge',   NULL, 1524, 1813, 'Danmark-Norge', NULL),
 ('Norge',   NULL, 1814, 1904, 'unionen Sverige-Norge', NULL),
 ('Danmark', NULL, 1397, 1523, 'Kalmarunionen', NULL),
 ('Danmark', NULL, 1524, 1813, 'Danmark-Norge', NULL),
 ('Danmark', 'Slesvig', 1460, 1863, 'hertugdømmene under den danske kongen', NULL),
 ('Danmark', 'Slesvig', 1864, 1870, 'Preussen', 'Nord-Slesvig kom tilbake til Danmark i 1920'),
 ('Danmark', 'Slesvig', 1871, 1919, 'Det tyske keiserriket', 'Nord-Slesvig kom tilbake til Danmark i 1920'),
 ('Danmark', 'Sønderjylland', 1864, 1870, 'Preussen', NULL),
 ('Danmark', 'Sønderjylland', 1871, 1919, 'Det tyske keiserriket', NULL),
 ('Sverige', NULL, 1397, 1522, 'Kalmarunionen', NULL),
 ('Sverige', 'Jämtland',   1397, 1644, 'Danmark-Norge', 'Norsk landskap til freden i Brømsebro 1645'),
 ('Sverige', 'Härjedalen', 1397, 1644, 'Danmark-Norge', 'Norsk landskap til freden i Brømsebro 1645'),
 ('Sverige', 'Bohuslän',   1397, 1657, 'Danmark-Norge', 'Norsk landskap til freden i Roskilde 1658'),
 ('Sverige', 'Göteborgs & Bohus län (O)', 1397, 1657, 'Danmark-Norge', 'Norsk landskap til freden i Roskilde 1658'),
 ('Sverige', 'Skåne',      1397, 1657, 'Danmark-Norge', 'Dansk landskap til freden i Roskilde 1658'),
 ('Sverige', 'Skaane',     1397, 1657, 'Danmark-Norge', 'Dansk landskap til freden i Roskilde 1658'),
 ('Sverige', 'Kristianstad', 1397, 1657, 'Danmark-Norge', 'Dansk landskap til freden i Roskilde 1658'),
 ('Sverige', 'Blekinge',   1397, 1657, 'Danmark-Norge', 'Dansk landskap til freden i Roskilde 1658'),
 ('Sverige', 'Halland',    1397, 1644, 'Danmark-Norge', 'Pantsatt til Sverige 1645, avstått 1658'),
 ('Tyskland', NULL, NULL, 1805, 'Det tysk-romerske rike', NULL),
 ('Tyskland', NULL, 1806, 1866, 'Det tyske forbund', NULL),
 ('Tyskland', NULL, 1867, 1870, 'Det nordtyske forbund', NULL),
 ('Tyskland', NULL, 1871, 1918, 'Det tyske keiserriket', NULL),
 ('Tyskland', 'Holstein',        1460, 1805, 'hertugdømmene under den danske kongen', 'Også del av Det tysk-romerske rike'),
 ('Tyskland', 'Holstein',        1806, 1863, 'hertugdømmene under den danske kongen', 'Også medlem av Det tyske forbund'),
 ('Tyskland', 'Slesvig',         1460, 1863, 'hertugdømmene under den danske kongen', NULL),
 ('Tyskland', 'Slesvig-Holsten', 1460, 1863, 'hertugdømmene under den danske kongen', NULL),
 ('Tyskland', 'Slesvig-Holstein',1460, 1863, 'hertugdømmene under den danske kongen', NULL),
 ('Tyskland', 'Schleswig-Holstein',1460, 1863, 'hertugdømmene under den danske kongen', NULL),
 ('Tyskland', 'Slesvig-Holsten', 1864, 1866, 'Preussen', NULL),
 ('Østerrike', NULL, NULL, 1805, 'Det tysk-romerske rike', NULL),
 ('Østerrike', NULL, 1806, 1866, 'Keiserriket Østerrike', NULL),
 ('Østerrike', NULL, 1867, 1918, 'Østerrike-Ungarn', NULL),
 ('Tsjekkia', NULL, NULL, 1805, 'Det tysk-romerske rike', 'Kongeriket Böhmen'),
 ('Tsjekkia', NULL, 1806, 1866, 'Keiserriket Østerrike', NULL),
 ('Tsjekkia', NULL, 1867, 1917, 'Østerrike-Ungarn', NULL),
 ('Tsjekkia', NULL, 1918, 1992, 'Tsjekkoslovakia', NULL),
 ('Slovakia', NULL, NULL, 1866, 'Kongeriket Ungarn', NULL),
 ('Slovakia', NULL, 1867, 1917, 'Østerrike-Ungarn', NULL),
 ('Slovakia', NULL, 1918, 1992, 'Tsjekkoslovakia', NULL),
 ('Ungarn',  NULL, 1867, 1918, 'Østerrike-Ungarn', NULL),
 ('Polen',   NULL, 1569, 1795, 'Polen-Litauen', NULL),
 ('Polen',   NULL, 1796, 1917, 'delt mellom Preussen, Russland og Østerrike', NULL),
 ('Polen',   'Schlesien', NULL, 1741, 'den böhmiske krone (Habsburg)', NULL),
 ('Polen',   'Schlesien', 1742, 1870, 'Preussen', NULL),
 ('Polen',   'Schlesien', 1871, 1945, 'Det tyske riket', NULL),
 ('Polen',   'Lebus',     NULL, 1805, 'Det tysk-romerske rike', 'Brandenburg'),
 ('Polen',   'Lebus',     1806, 1945, 'Preussen', 'Brandenburg; tysk til 1945'),
 ('Polen',   'Koszzlin',  NULL, 1805, 'Det tysk-romerske rike', 'Pommern'),
 ('Polen',   'Koszzlin',  1806, 1945, 'Preussen', 'Pommern; tysk til 1945'),
 ('Polen',   'Pommern',   NULL, 1805, 'Det tysk-romerske rike', NULL),
 ('Polen',   'Pommern',   1806, 1945, 'Preussen', 'Tysk til 1945'),
 ('Litauen', NULL, NULL, 1568, 'Storfyrstedømmet Litauen', NULL),
 ('Litauen', NULL, 1569, 1795, 'Polen-Litauen', NULL),
 ('Litauen', NULL, 1796, 1917, 'Russland', NULL),
 ('Russland','Ostpreußen', NULL, 1870, 'Preussen', NULL),
 ('Russland','Ostpreußen', 1871, 1945, 'Det tyske riket', NULL),
 ('Finland', NULL, NULL, 1808, 'Sverige', NULL),
 ('Finland', NULL, 1809, 1916, 'Storfyrstedømmet Finland (Russland)', NULL),
 ('Island',  NULL, 1380, 1813, 'Danmark-Norge', NULL),
 ('Island',  NULL, 1814, 1917, 'Danmark', NULL),
 ('Nederland', NULL, NULL, 1580, 'De habsburgske Nederlandene', NULL),
 ('Nederland', NULL, 1581, 1794, 'De forente Nederlandene', NULL)
) v(country, region, f, t, polity, note)
JOIN polities p ON p.name = v.polity
WHERE NOT EXISTS (SELECT 1 FROM place_jurisdictions j WHERE j.country = v.country AND j.region IS NOT DISTINCT FROM v.region
                    AND j.valid_from IS NOT DISTINCT FROM v.f AND j.polity_id = p.id);

-- ---------- Stedsnavn over tid (dagens navn, land, historisk navn, fra, til)
INSERT INTO place_name_periods (modern_name, country, historical_name, valid_from, valid_to, note)
SELECT * FROM (VALUES
 ('Oslo',       'Norge',    'Christiania', 1624, 1877, 'Byen ble flyttet og omdøpt etter bybrannen 1624'),
 ('Oslo',       'Norge',    'Kristiania',  1878, 1924, 'Ny rettskrivning; Oslo fra 1. januar 1925'),
 ('Trondheim',  'Norge',    'Trondhjem',   1500, 1929, NULL),
 ('Trondheim',  'Norge',    'Nidaros',     1930, 1930, 'Offisielt navn 1930–31'),
 ('Stavern',    'Norge',    'Fredriksvern',1750, 1929, NULL),
 ('Kristiansund','Norge',   'Christianssund', 1742, 1876, NULL),
 ('Kristiansand','Norge',   'Christianssand', 1641, 1876, NULL),
 ('Wrocław',    'Polen',    'Breslau',     NULL, 1945, NULL),
 ('Brzeg',      'Polen',    'Brieg',       NULL, 1945, NULL),
 ('Opole',      'Polen',    'Oppeln',      NULL, 1945, NULL),
 ('Nysa',       'Polen',    'Neisse',      NULL, 1945, NULL),
 ('Legnica',    'Polen',    'Liegnitz',    NULL, 1945, NULL),
 ('Prudnik',    'Polen',    'Neustadt',    NULL, 1945, 'Neustadt in Oberschlesien'),
 ('Słońsk',     'Polen',    'Sonnenburg',  NULL, 1945, NULL),
 ('Szczecin',   'Polen',    'Stettin',     NULL, 1945, NULL),
 ('Gdańsk',     'Polen',    'Danzig',      NULL, 1945, NULL),
 ('Kaliningrad','Russland', 'Königsberg',  NULL, 1946, NULL),
 ('Helsinki',   'Finland',  'Helsingfors', NULL, 1917, 'Svensk navn i svensk og russisk tid'),
 ('Turku',      'Finland',  'Åbo',         NULL, 1917, NULL),
 ('Tallinn',    'Estland',  'Reval',       NULL, 1918, NULL),
 ('Vilnius',    'Litauen',  'Wilno',       NULL, 1939, 'Polsk/polsk-litauisk navn')
) v(modern_name, country, historical_name, f, t, note)
WHERE NOT EXISTS (SELECT 1 FROM place_name_periods x WHERE x.modern_name = v.modern_name AND x.historical_name = v.historical_name);

-- Data som ble rotet til under import og som oppslaget ellers ville bomme på
UPDATE addresses SET country = 'Russland', name_display = 'Kaliningrad, Russland' WHERE id = 442 AND country = 'Tyskland';
UPDATE addresses SET city = 'Wrocław', county = 'Schlesien', name_display = 'Wrocław, Schlesien, Polen' WHERE id = 1095;
UPDATE addresses SET city = 'Oslo', name_display = coalesce(nullif(name_display, ''), name_short || ', Oslo')
  WHERE city IN ('Kristiania', 'today Oslo city') AND country = 'Norge';
UPDATE addresses SET city = 'Trondheim' WHERE city = 'Sor-Trondelag' AND country = 'Norge';
UPDATE addresses SET country = 'Polen', city = 'Nysa', historical_region = 'Schlesien' WHERE id = 864;

COMMIT;

SELECT (SELECT count(*) FROM polities) riker, (SELECT count(*) FROM place_jurisdictions) tilhorighet, (SELECT count(*) FROM place_name_periods) navneperioder;
