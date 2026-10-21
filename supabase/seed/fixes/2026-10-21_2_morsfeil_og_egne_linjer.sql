-- ============================================================
-- Datarettinger 21.10.2026, del 2 — funn fra mønstersjekken
--   A. Fyrstehus: barn lagt under feil kone (Christian IV, Johann Georg av Brandenburg, Anton I av Aldenburg)
--   B. Egne linjer: Kindt, Randulf, Bull, Benkestok/Bloch, Martens, Geelmuyden
-- Én transaksjon: enten går alt gjennom, eller ingenting.
-- ============================================================
BEGIN;

CREATE TEMP TABLE _mv (c text, from_f text, to_f text, why text) ON COMMIT DROP;
CREATE TEMP TABLE _mg (p text, s text, why text) ON COMMIT DROP;
CREATE TEMP TABLE _del (pid text, why text) ON COMMIT DROP;

-- ---------- Ny familie: Johan Randulf + ukjent annen kone (barn født etter at Magdalene Smed døde 1720)
INSERT INTO families (family_id, husband_id, wife_id, family_type) VALUES ('F502006', 'I500618', NULL, 'married') ON CONFLICT DO NOTHING;

-- ---------- Flytt barn
INSERT INTO _mv VALUES
  -- Johann Georg av Brandenburg (Wikipedia): Sophie av Liegnitz (g. 1545, d. 1546) fikk bare Joachim Friedrich
  ('I501575','F500410','F500487','Barn av Elisabeth av Anhalt-Zerbst (g. 1577), ikke Sophie av Liegnitz (d. 1546)'),
  ('I501576','F500410','F500487','Barn av Elisabeth av Anhalt-Zerbst (g. 1577), ikke Sophie av Liegnitz (d. 1546)'),
  ('I501577','F500410','F500487','Barn av Elisabeth av Anhalt-Zerbst (g. 1577), ikke Sophie av Liegnitz (d. 1546)'),
  ('I501578','F500410','F500487','Barn av Elisabeth av Anhalt-Zerbst (g. 1577), ikke Sophie av Liegnitz (d. 1546)'),
  ('I501579','F500410','F500487','Barn av Elisabeth av Anhalt-Zerbst (g. 1577), ikke Sophie av Liegnitz (d. 1546)'),
  ('I501580','F500410','F500487','Barn av Elisabeth av Anhalt-Zerbst (g. 1577), ikke Sophie av Liegnitz (d. 1546)'),
  ('I501581','F500410','F500479','Anna Maria (1567) er datter av Sabina av Brandenburg-Ansbach'),
  ('I501810','F500487','F500479','Margarethe (1565) er datter av Sabina, ikke Elisabeth (f. 1563)'),
  ('I501811','F500487','F500479','Sophie (1568) er datter av Sabina, ikke Elisabeth (f. 1563)'),
  -- Sabinas barn lå spredt i familier med navnløse mødre
  ('I501797','F500481','F500479','Georg Albrecht (1555) er sønn av Sabina'),
  ('I501799','F500482','F500479','Johann (1557) er sønn av Sabina'),
  ('I501801','F500483','F500479','Magdalena Sabina (1559) er datter av Sabina'),
  ('I501803','F500484','F500479','Erdmuthe (1561) er datter av Sabina'),
  ('I501805','F500485','F500479','Marie (1562) er datter av Sabina'),
  ('I501807','F500486','F500479','Hedwig (1563) er datter av Sabina'),
  -- Anton I av Aldenburg: alle døtrene er med Auguste Johanna av Sayn-Wittgenstein (g. 1659)
  ('I501655','F500446','F500370','Datter av Auguste Johanna av Sayn-Wittgenstein; Charlotte de La Trémoille ble gift med Anton først i 1680'),
  ('I501656','F500446','F500370','Datter av Auguste Johanna av Sayn-Wittgenstein; Charlotte de La Trémoille ble gift med Anton først i 1680'),
  -- Bull: Jens Andersen Bull hadde én kone, Lucia Jensdatter (vestraat.net)
  ('I500668','F500157','F500155','Datter av Lucia Jensdatter, ikke Anna Hansdatter'),
  ('I500669','F500157','F500155','Datter av Lucia Jensdatter, ikke Anna Hansdatter'),
  ('I500670','F500157','F500155','Sønn av Lucia Jensdatter, ikke Anna Hansdatter'),
  -- Randulf: født etter at Magdalene Smed døde (1720)
  ('I500629','F500149','F502006','Født 1722, etter at Magdalene Smed døde i 1720 – mor ukjent'),
  ('I500630','F500149','F502006','Født 1726, etter at Magdalene Smed døde i 1720 – mor ukjent');
UPDATE family_children fc SET family_id = m.to_f FROM _mv m WHERE fc.child_id = m.c AND fc.family_id = m.from_f;
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
  SELECT c, 'claude', 'update', 'family_children', 'family_id', from_f, to_f, why FROM _mv;

-- ---------- Duplikater
INSERT INTO _mg VALUES
  ('I501405','I501454','Anna Kathrine (10.8.1618–20.8.1633), Kirsten Munks datter, lå også under Anna av Brandenburg (d. 1612)'),
  ('I501438','I501570','Valdemar Christian (1622–1656), Kirsten Munks sønn, lå også under Anna av Brandenburg (d. 1612)'),
  ('I500648','I500672','Jørgen Jensen Bull (1585–1665) lå også inne som sønn av sin egen farfar'),
  ('I500095','I502367','Edvard Colbjørnsen Trampe Kindt (f. 1879) lå inne to ganger');
DELETE FROM _mg m USING persons p WHERE p.person_id = m.s AND p.is_deleted;
UPDATE families f SET husband_id = m.p FROM _mg m WHERE f.husband_id = m.s;
UPDATE families f SET wife_id = m.p FROM _mg m WHERE f.wife_id = m.s;
-- duplikatet skal ikke ta med seg feilplasseringen
DELETE FROM family_children c USING _mg m WHERE c.child_id = m.s
  AND (EXISTS (SELECT 1 FROM family_children x WHERE x.child_id = m.p AND x.family_id = c.family_id)
       OR c.family_id IN ('F500380','F500156'));
UPDATE family_children c SET child_id = m.p FROM _mg m WHERE c.child_id = m.s;
INSERT INTO person_names (person_id, name_type, given_name, middle_name, surname, prefix, nickname, is_preferred)
  SELECT m.p, n.name_type, n.given_name, n.middle_name, n.surname, n.prefix, n.nickname, false
  FROM person_names n JOIN _mg m ON n.person_id = m.s
  WHERE NOT EXISTS (SELECT 1 FROM person_names x WHERE x.person_id = m.p
      AND coalesce(x.given_name,'')||coalesce(x.middle_name,'')||coalesce(x.surname,'') = coalesce(n.given_name,'')||coalesce(n.middle_name,'')||coalesce(n.surname,''));
INSERT INTO person_facts (person_id, fact_type, date_text, date_year, date_month, date_day, place_raw, notes, place_city, place_region, place_country)
  SELECT m.p, f.fact_type, f.date_text, f.date_year, f.date_month, f.date_day, f.place_raw, f.notes, f.place_city, f.place_region, f.place_country
  FROM person_facts f JOIN _mg m ON f.person_id = m.s
  WHERE NOT EXISTS (SELECT 1 FROM person_facts x WHERE x.person_id = m.p AND x.fact_type = f.fact_type);
UPDATE address_periods a SET entity_id = m.p FROM _mg m WHERE a.entity_type = 'person' AND a.entity_id = m.s;
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

-- ---------- Personer som ikke leder noe sted (ingen egne barn/ektefeller, ingen kilde utover importen)
INSERT INTO _del VALUES
  ('I500453','«Ukjent Ukjent» f. 1765 – plassholder, født 11 år etter Detleff Martens'' død'),
  ('I500186','Navnløs «Geelmuyden» f. 1822 – født 30 år etter Knud Geelmuydens død. Trolig Bernhard Fredrik de Lange Geelmuyden (1823–1903) fra en annen gren.'),
  ('I500671','«Lucia Jensdatter Bull» uten data – ikke blant Jens Bulls barn i kildene; trolig forveksling med moren Lucia'),
  ('I501795','Albert Frederick av Preussen (1553) er sønn av hertug Albrecht av Preussen, ikke av Johann Georg'),
  ('I501796','Navnløs plassholder-kone'),('I501798','Navnløs plassholder-kone'),('I501800','Navnløs plassholder-kone'),
  ('I501802','Navnløs plassholder-kone'),('I501804','Navnløs plassholder-kone'),('I501806','Navnløs plassholder-kone'),
  ('I501808','Navnløs plassholder-kone');
-- sikkerhetsnett: hopp over hvis personen likevel har barn eller er forelder i en familie med barn
DELETE FROM _del d WHERE EXISTS (
  SELECT 1 FROM families f JOIN family_children c USING (family_id)
  WHERE d.pid IN (f.husband_id, f.wife_id) AND c.child_id NOT IN ('I501795'));
DELETE FROM family_children WHERE child_id IN (SELECT pid FROM _del);
DELETE FROM families WHERE family_id IN ('F500480','F500481','F500482','F500483','F500484','F500485','F500486')
  AND NOT EXISTS (SELECT 1 FROM family_children c WHERE c.family_id = families.family_id);
UPDATE persons SET is_deleted = true WHERE person_id IN (SELECT pid FROM _del);
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  SELECT pid, 'claude', 'delete', 'persons', 'Fjernet: ' || why FROM _del;

-- ---------- Datoer
-- Aldenburg: første ekteskap var 1659 (ikke samme dato som det andre)
UPDATE families SET marr_date = '27 APR 1659' WHERE family_id = 'F500370';
-- Sabina av Brandenburg-Ansbach døde 1575
UPDATE person_facts SET date_text = '2 NOV 1575', date_year = 1575 WHERE person_id = 'I501790' AND fact_type = 'DEAT';
-- Christian IV og Vibeke Kruse var ikke gift (datoen var kopiert fra Kirsten Munk-ekteskapet)
UPDATE families SET marr_date = NULL WHERE family_id = 'F500388';
-- Bull: vielsesåret «1459» er en skrivefeil
UPDATE families SET marr_date = NULL WHERE family_id = 'F500155';
UPDATE person_facts SET date_text = NULL, date_year = NULL,
  notes = coalesce(notes || ' ', '') || '[Rettet 2026-10-21: «BEF 1485» fjernet – ga mor yngre enn sønnen. Slektsledd før Jens Andersen Bull er udokumenterte.]'
  WHERE person_id = 'I500680' AND fact_type = 'BIRT';
-- Randulf: døde 1735 (ikke 1718 på Ås)
UPDATE person_facts SET date_text = '1735', date_year = 1735, place_raw = NULL, place_id = NULL, place_city = NULL, place_region = NULL, place_country = NULL,
  notes = 'Rettet 2026-10-21 fra 1718 (Aas, Frogn). Barn født 1722 og 1726 i Nærøy; kielland-brandt.dk oppgir 1681–1735.'
  WHERE person_id = 'I500618' AND fact_type = 'DEAT';
DELETE FROM person_facts WHERE person_id = 'I500618' AND fact_type = 'BURI' AND date_year = 1718;
-- Bloch: Maren må være født før farens død 1636
UPDATE person_facts SET date_text = 'BEF 1637', date_year = 1636,
  notes = 'Rettet 2026-10-21 fra «ABT 1662»: faren Christen Bloch døde 1636 og moren var født ca. 1595.'
  WHERE person_id = 'I501770' AND fact_type = 'BIRT';
-- Kindt: dødsdatoen 22.3.1891 motsies av barn født 1906 og 1909 (og er samme dag/måned som Ediths fødsel)
UPDATE person_facts SET notes = coalesce(notes || ' ', '') ||
  '[Fjernet 2026-10-21: «død 22 MAR 1891 i Harstad» – umulig, han fikk barn 1906 og 1909. Trolig sammenblanding med en annen Edvard Kindt.]'
  WHERE person_id = 'I500095' AND fact_type = 'BIRT';
DELETE FROM person_facts WHERE person_id = 'I500095' AND fact_type = 'DEAT' AND date_year = 1891;

-- ---------- Friller
INSERT INTO person_roles (person_id, role_type, value, role_id, reason, source)
SELECT v.pid, 'other', 'Frille', rc.id, v.why, 'Utledet 2026-10-21'
FROM (VALUES ('I501442','Frille av Christian IV; mor til Ulrik Christian Gyldenløve.'),
             ('I501412','Frille av Christian IV.')) v(pid, why)
JOIN role_catalog rc ON rc.name = 'Frille'
WHERE NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = v.pid AND x.role_id = rc.id);

-- ---------- Kilder
INSERT INTO person_sources (person_id, archive, title, url, record_type, found_date, found_by, notes)
SELECT * FROM (VALUES
 ('I501571','Wikipedia','John George, Elector of Brandenburg','https://en.wikipedia.org/wiki/John_George,_Elector_of_Brandenburg','encyclopedia','2026-10-21','Claude',
  'Tre ekteskap: Sophie av Liegnitz 1545 (Joachim Friedrich), Sabina av Brandenburg-Ansbach 1548 (11 barn 1555–1568), Elisabeth av Anhalt-Zerbst 1577 (11 barn 1581–1598).'),
 ('I501349','Wikipedia (de)','Anton I. von Aldenburg','https://de.wikipedia.org/wiki/Anton_I._von_Aldenburg','encyclopedia','2026-10-21','Claude',
  'Gift 27.4.1659 med Auguste Johanna av Sayn-Wittgenstein (fem døtre 1660–1665), 29.5.1680 med Charlotte Amélie de La Trémoille (Anton II, født etter farens død).'),
 ('I500618','kielland-brandt.dk','Randulff/Wandal','https://kielland-brandt.dk/RandulffWandal.html','family_history','2026-10-21','Claude',
  'Johan Randulff (1681–1735) og Magdalene Margrethe Nielsdatter Smed (1692–1720).'),
 ('I500661','vestraat.net','Etterkommere etter Jens Andersen Bull','https://vestraat.net/ettersl/bull0001.htm','family_history','2026-10-21','Claude',
  'Én kone, Lucia Jensdatter. Barn: Maren (ca. 1580–1644), Anna (ca. 1580), Sara (ca. 1585–1652), Jens (ca. 1585), Karen (ca. 1585), Jørgen (1585–1665).')
) v(person_id, archive, title, url, record_type, found_date, found_by, notes)
WHERE NOT EXISTS (SELECT 1 FROM person_sources s WHERE s.person_id = v.person_id AND s.url = v.url);

COMMIT;

-- Kontroll: skal gi null rader for disse familiene
WITH b AS (SELECT person_id, min(date_year) y FROM person_facts WHERE fact_type='BIRT' AND date_year IS NOT NULL GROUP BY 1),
     d AS (SELECT person_id, min(date_year) y FROM person_facts WHERE fact_type='DEAT' AND date_year IS NOT NULL GROUP BY 1)
SELECT f.family_id, fc.child_id, cb.y barn_f, wb.y mor_f, wd.y mor_d, hd.y far_d
FROM families f JOIN family_children fc USING (family_id) JOIN persons p ON p.person_id = fc.child_id AND NOT p.is_deleted
JOIN b cb ON cb.person_id = fc.child_id
LEFT JOIN b wb ON wb.person_id = f.wife_id LEFT JOIN d wd ON wd.person_id = f.wife_id LEFT JOIN d hd ON hd.person_id = f.husband_id
WHERE f.family_id IN ('F500380','F500410','F500487','F500479','F500446','F500370','F500149','F502006','F500155','F500157','F500156','F500472','F500106','F500042','F500291')
  AND (cb.y - wb.y < 14 OR cb.y > wd.y OR cb.y > hd.y + 1);
