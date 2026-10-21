-- ============================================================
-- 2026-10-21 · 11: funn fra gjennomgangen av fem profilsider
--   A. Dobbeltpersoner: Nicolay Bull Wiig (1905–1996), Søren Willum Wiig (1965–2012)
--   B. Nicolay Kieding Wiig: eksakte datoer, dobbelt styreverv, rå ID i polio-notatet
--   C. Hans Andvig: folketelling 1891 (før han ble født) og fødested 1894 → 1895
--   D. Navn: Jens Munthe Johansen Bull, Gidsken Edvardine Bull (1819)
--   E. Nicolay Tallberg Wiig: Partnership Manager i DNB fra august 2026
--   F. Hovedyrke kan overstyres: person_roles.is_primary
--   G. Bestum, Ullern, Nordstrand m.fl. lå i Aker herred til 1948 (ikke Kristiania)
-- Én transaksjon: enten går alt gjennom, eller ingenting.
-- ============================================================
BEGIN;

-- ---------- A. Dobbeltpersoner (samme mønster som SQL 2)
CREATE TEMP TABLE _mg (p text, s text, why text) ON COMMIT DROP;
INSERT INTO _mg VALUES
  ('I502363','I500024','Nicolay Bull Wiig (15.5.1905–26.6.1996) lå inne to ganger med identiske datoer'),
  ('I500010','I502374','Søren Willum Wiig (15.3.1965–2012) lå inne to ganger som barn av Nicolay Kieding Wiig og Ellen Kathrine Andvig');
DELETE FROM _mg m USING persons p WHERE p.person_id = m.s AND p.is_deleted;
UPDATE families f SET husband_id = m.p FROM _mg m WHERE f.husband_id = m.s;
UPDATE families f SET wife_id = m.p FROM _mg m WHERE f.wife_id = m.s;
DELETE FROM family_children c USING _mg m WHERE c.child_id = m.s
  AND EXISTS (SELECT 1 FROM family_children x WHERE x.child_id = m.p AND x.family_id = c.family_id);
UPDATE family_children c SET child_id = m.p FROM _mg m WHERE c.child_id = m.s;
INSERT INTO person_names (person_id, name_type, given_name, middle_name, surname, prefix, nickname, is_preferred)
  SELECT m.p, n.name_type, n.given_name, n.middle_name, n.surname, n.prefix, n.nickname, false
  FROM person_names n JOIN _mg m ON n.person_id = m.s
  WHERE NOT EXISTS (SELECT 1 FROM person_names x WHERE x.person_id = m.p
      AND coalesce(x.given_name,'')||coalesce(x.middle_name,'')||coalesce(x.surname,'') = coalesce(n.given_name,'')||coalesce(n.middle_name,'')||coalesce(n.surname,''));
INSERT INTO person_facts (person_id, fact_type, date_text, date_year, date_month, date_day, place_raw, place_id, notes, place_city, place_region, place_country)
  SELECT m.p, f.fact_type, f.date_text, f.date_year, f.date_month, f.date_day, f.place_raw, f.place_id, f.notes, f.place_city, f.place_region, f.place_country
  FROM person_facts f JOIN _mg m ON f.person_id = m.s
  WHERE NOT EXISTS (SELECT 1 FROM person_facts x WHERE x.person_id = m.p AND x.fact_type = f.fact_type);
UPDATE address_periods a SET entity_id = m.p FROM _mg m WHERE a.entity_type = 'person' AND a.entity_id = m.s
  AND NOT EXISTS (SELECT 1 FROM address_periods x WHERE x.entity_type = 'person' AND x.entity_id = m.p
      AND x.address_id = a.address_id AND x.period_type = a.period_type);
UPDATE person_photos ph SET person_id = m.p, is_primary = false FROM _mg m WHERE ph.person_id = m.s;
UPDATE person_sources so SET person_id = m.p FROM _mg m WHERE so.person_id = m.s;
UPDATE person_roles r SET person_id = m.p FROM _mg m WHERE r.person_id = m.s
  AND NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = m.p AND (x.role_id = r.role_id OR x.value = r.value));
UPDATE person_biography b SET person_id = m.p FROM _mg m
  WHERE b.person_id = m.s AND NOT EXISTS (SELECT 1 FROM person_biography x WHERE x.person_id = m.p);
UPDATE persons ps SET is_deleted = true FROM _mg m WHERE ps.person_id = m.s;
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  SELECT s, 'claude', 'delete', 'persons', 'Slått sammen med ' || p || ': ' || why FROM _mg
  UNION ALL SELECT p, 'claude', 'update', 'persons', 'Overtok data fra duplikat ' || s || ': ' || why FROM _mg;

-- Duplikatets navnløse «kone» (I501930, bare en tom dødsfakta) – ekte kone er Ragnhild Mohn Heldal (gift 1938)
DELETE FROM families WHERE family_id = 'F500512'
  AND NOT EXISTS (SELECT 1 FROM family_children c WHERE c.family_id = 'F500512');
UPDATE persons SET is_deleted = true WHERE person_id = 'I501930'
  AND NOT EXISTS (SELECT 1 FROM person_names WHERE person_id = 'I501930')
  AND NOT EXISTS (SELECT 1 FROM families WHERE 'I501930' IN (husband_id, wife_id));
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I501930','claude','delete','persons','Navnløs plassholder-kone til duplikatet I500024 av Nicolay Bull Wiig. Hans kone var Ragnhild Mohn Heldal (I502373).');

-- ---------- B. Nicolay Kieding Wiig (I500007)
UPDATE person_facts SET date_text = '12 OCT 1928', date_year = 1928, date_month = 10, date_day = 12
  WHERE person_id = 'I500007' AND fact_type = 'BIRT' AND date_text = '1928';
UPDATE person_facts SET date_text = 'JAN 2016', date_year = 2016, date_month = 1, date_day = NULL
  WHERE person_id = 'I500007' AND fact_type = 'DEAT' AND date_text = '2016';
-- Styremedlem og Styreleder i BT var samme verv («styremedlem, deretter styreformann»)
DELETE FROM person_roles WHERE id = 12336 AND person_id = 'I500007' AND value = 'Styremedlem';
UPDATE person_roles SET reason = 'Styremedlem fra 1958, etter hvert styreformann. Tok initiativet til BTs deltakelse i TV2 i Bergen 1990.'
  WHERE id = 12582 AND person_id = 'I500007';
UPDATE person_facts SET notes = replace(notes, 'onkel Nicolay Bull Wiig (I502363)', 'onkel Nicolay Bull Wiig')
  WHERE person_id = 'I500007' AND notes LIKE '%(I502363)%';
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I500007','claude','update','person_facts','Fødsel 1928 → 12.10.1928 og død 2016 → januar 2016, som i biografien.'),
  ('I500007','claude','delete','person_roles','Styremedlem i BT fjernet – samme verv som Styreleder (styremedlem fra 1958, senere styreformann).');

-- ---------- C. Hans Andvig (I500011)
-- Folketelling 1891 kan ikke gjelde ham (født 8.3.1895)
DELETE FROM address_periods WHERE id = 2663 AND entity_id = 'I500011';
DELETE FROM person_facts WHERE id = 80 AND person_id = 'I500011' AND fact_type = 'CENS' AND date_text = '1891';
UPDATE address_periods SET date_from = '1895' WHERE id = 612 AND entity_id = 'I500011' AND date_from = '1894';
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I500011','claude','delete','person_facts','Folketelling 1891 (Skien) fjernet: han ble født 8.3.1895. Trolig feilkoblet fra GEDCOM.'),
  ('I500011','claude','update','address_periods','Fødested-perioden rettet fra 1894 til 1895 (fødselsåret ble rettet tidligere, jf. nettgrav.no).');

-- ---------- D. Navn
UPDATE person_names SET surname = 'Bull' WHERE person_id = 'I500139' AND surname = 'Munthe Johansen Bull' AND middle_name = 'Munthe Johansen';
UPDATE person_names SET middle_name = 'Edvardine' WHERE person_id = 'I500141' AND middle_name = 'Edvardine 2';
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I500139','claude','update','person_names','Etternavn «Munthe Johansen Bull» → «Bull» (Munthe Johansen står allerede som mellomnavn).'),
  ('I500141','claude','update','person_names','Mellomnavn «Edvardine 2» → «Edvardine». Hun døde som spedbarn i 1819; søsteren født 1822 fikk samme navn.');

-- ---------- E. Nicolay Tallberg Wiig (I500001): ny jobb i DNB fra august 2026
INSERT INTO role_catalog (name, category, social_group, description, is_ai_generated, is_approved)
  SELECT 'Partnership Manager', 'occupation', 'Moderne arbeidsliv',
         'Ansvarlig for samarbeid med eksterne partnere – avtaler, oppfølging og felles produkter.', true, false
  WHERE NOT EXISTS (SELECT 1 FROM role_catalog WHERE name = 'Partnership Manager');
UPDATE person_roles SET date_to = '2026-07' WHERE id = 12451 AND person_id = 'I500001' AND date_to IS NULL;
INSERT INTO person_roles (person_id, role_type, value, place, date_from, role_id, reason)
  SELECT 'I500001', 'occupation', 'Partnership Manager', 'DNB', '2026-08',
         (SELECT id FROM role_catalog WHERE name = 'Partnership Manager'), 'Personmarked.'
  WHERE NOT EXISTS (SELECT 1 FROM person_roles WHERE person_id = 'I500001' AND value = 'Partnership Manager');

-- ---------- F. Manuell overstyring av hovedyrket på profilen
ALTER TABLE person_roles ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN person_roles.is_primary IS 'Vises som hovedyrke under navnet på personsiden. Uten merking velges automatisk: levende = nåværende stilling, døde = mest kjente (se src/lib/roles.js).';

-- ---------- G. Steder i Aker herred (innlemmet i Oslo 1948)
INSERT INTO place_name_periods (modern_name, country, address_id, historical_name, valid_from, valid_to, note)
  SELECT 'Oslo', 'Norge', a.id, 'Aker', 1837, 1947, 'Aker herred, innlemmet i Oslo 1. januar 1948'
  FROM addresses a
  WHERE a.id IN (648, 682, 1188, 1310, 1431, 1333, 1466, 552, 557, 938)
    AND NOT EXISTS (SELECT 1 FROM place_name_periods x WHERE x.address_id = a.id);

COMMIT;

-- Kontroll
SELECT
  (SELECT count(*) FROM persons WHERE person_id IN ('I500024','I502374','I501930') AND is_deleted) slettet_dupl,   -- 3
  (SELECT count(*) FROM family_children WHERE family_id = 'F500003') barn_bestefar,                                -- 4
  (SELECT date_text FROM person_facts WHERE person_id = 'I500007' AND fact_type = 'BIRT') bestefar_fodt,            -- 12 OCT 1928
  (SELECT value || ' · ' || place FROM person_roles WHERE person_id = 'I500001' AND date_to IS NULL AND role_type = 'occupation') naa;
