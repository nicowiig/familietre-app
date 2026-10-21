-- ============================================================
-- Datarettinger 21.10.2026, del 3 — resten av mønstersjekken
-- (feil mor/kone, umulige fødselsår, barn i feil familie)
-- Én transaksjon: enten går alt gjennom, eller ingenting.
-- ============================================================
BEGIN;

CREATE TEMP TABLE _mv (c text, from_f text, to_f text, why text) ON COMMIT DROP;
CREATE TEMP TABLE _mg (p text, s text, why text) ON COMMIT DROP;
CREATE TEMP TABLE _del (pid text, why text) ON COMMIT DROP;

-- ---------- Ny person: Johan Martens' første kone (geneanet / Arvid Østbye)
INSERT INTO persons (person_id, sex, is_living) VALUES ('I502387', 'F', false) ON CONFLICT DO NOTHING;
INSERT INTO person_names (person_id, name_type, given_name, surname, is_preferred)
  SELECT 'I502387', 'birth', 'Maren Malene', 'Hagelsteen', true WHERE NOT EXISTS (SELECT 1 FROM person_names WHERE person_id = 'I502387');
INSERT INTO person_facts (person_id, fact_type, date_text, date_year, place_raw)
  SELECT * FROM (VALUES ('I502387','BIRT','1771',1771,'Bergen'), ('I502387','DEAT','1799',1799,'Bergen')) v
  WHERE NOT EXISTS (SELECT 1 FROM person_facts WHERE person_id = 'I502387');

-- ---------- Nye familier
INSERT INTO families (family_id, husband_id, wife_id, marr_date, marr_place_raw, family_type) VALUES
  ('F502007','I500161','I502387','10 JUL 1792','Bergen','married'),   -- Johan Martens + Maren Malene Hagelsteen
  ('F502008',NULL,'I500484',NULL,NULL,'married'),                      -- Anna Stina Andersdatter + ukjent Bengt
  ('F502010','I501498',NULL,NULL,NULL,'married'),                      -- Anders Aarsæter + ukjent første kone
  ('F502011',NULL,'I501986',NULL,NULL,'married'),                      -- ukjent Gran + Else Akkermann (Jens Grans foreldre)
  ('F502012',NULL,'I502324',NULL,NULL,'married'),                      -- Berte Hansdatter + ukjent annen mann
  ('F502013',NULL,'I502086','24 JUN 1830',NULL,'married')              -- Randi Reite + ukjent Peder
ON CONFLICT DO NOTHING;

-- ---------- Hveding: magistrat Jens Christensen Hveding (1691–1758) og Elisabeth Marie Herdal (vestraat.net)
INSERT INTO persons (person_id, sex, is_living) VALUES ('I502389','M',false), ('I502390','F',false) ON CONFLICT DO NOTHING;
INSERT INTO person_names (person_id, name_type, given_name, middle_name, surname, is_preferred)
  SELECT * FROM (VALUES ('I502389','birth','Jens','Christensen','Hveding',true),
                        ('I502390','birth','Elisabeth Marie','Pedersdatter','Herdal',true)) v(a,b,c,d,e,f)
  WHERE NOT EXISTS (SELECT 1 FROM person_names WHERE person_id IN ('I502389','I502390'));
INSERT INTO person_facts (person_id, fact_type, date_text, date_year, place_raw)
  SELECT * FROM (VALUES ('I502389','BIRT','1691',1691,'Hamarøy, Nordland'), ('I502389','DEAT','1758',1758,'Trondheim')) v(a,b,c,d,e)
  WHERE NOT EXISTS (SELECT 1 FROM person_facts WHERE person_id = 'I502389');
INSERT INTO families (family_id, husband_id, wife_id, marr_date, family_type)
  VALUES ('F502015','I502389','I502390','17 JUL 1720','married') ON CONFLICT DO NOTHING;
-- født 1691 på Hamarøy: sønn av Christen Jensen Hveding (d. 1696 på Hamarøy)
INSERT INTO family_children (family_id, child_id)
  SELECT family_id, 'I502389' FROM families WHERE husband_id = 'I501370' ORDER BY family_id LIMIT 1
  ON CONFLICT DO NOTHING;
INSERT INTO person_roles (person_id, role_type, value, place, source)
  SELECT 'I502389', 'position', 'Magistrat', 'Trondheim', 'vestraat.net (Etterkommere etter Christen Jensen Hveding)'
  WHERE NOT EXISTS (SELECT 1 FROM person_roles WHERE person_id = 'I502389');
UPDATE person_facts SET date_text = '31 JAN 1731', date_year = 1731, date_month = 1, date_day = 31,
  notes = 'Rettet 2026-10-21 fra 30 JAN 1730 (vestraat.net).'
  WHERE person_id = 'I501382' AND fact_type = 'BIRT';
UPDATE person_facts SET notes = coalesce(notes || ' ', '') || '[Døpt 30.1.1736 i Trondhjem (vestraat.net).]'
  WHERE person_id = 'I501383' AND fact_type = 'BIRT';

-- ---------- Flytt barn
INSERT INTO _mv VALUES
  -- Martens: fem barn med første kone Maren Malene Hagelsteen (g. 1792, d. 1799)
  ('I500171','F500039','F502007','Barn av første kone Maren Malene Hagelsteen (g. 1792)'),
  ('I500172','F500039','F502007','Barn av første kone Maren Malene Hagelsteen (g. 1792)'),
  ('I500173','F500039','F502007','Barn av første kone Maren Malene Hagelsteen (g. 1792)'),
  ('I500174','F500039','F502007','Barn av første kone Maren Malene Hagelsteen (g. 1792)'),
  -- Martens: barna i «Johan Martens + Margaretha Dahl» er Bente Hagelsteens (Dahl var Nicolay Johans kone)
  ('I500165','F500040','F500039','Barn av Bente Cathrine Hagelsteen; Margaretha Dahl var gift med sønnen Nicolay Johan'),
  ('I500166','F500040','F500039','Barn av Bente Cathrine Hagelsteen; Margaretha Dahl var gift med sønnen Nicolay Johan'),
  ('I500167','F500040','F500039','Barn av Bente Cathrine Hagelsteen; Margaretha Dahl var gift med sønnen Nicolay Johan'),
  ('I500168','F500040','F500039','Barn av Bente Cathrine Hagelsteen; Margaretha Dahl var gift med sønnen Nicolay Johan'),
  ('I500169','F500040','F500039','Barn av Bente Cathrine Hagelsteen; Margaretha Dahl var gift med sønnen Nicolay Johan'),
  ('I500170','F500040','F500039','Barn av Bente Cathrine Hagelsteen; Margaretha Dahl var gift med sønnen Nicolay Johan'),
  -- Balchen: barn født før 1820 er med Christiane Guldbrandsen (g. 1810, d. 1819), ikke Gjertrud Brunchorst (f. 1801)
  ('I500841','F500105','F500103','Født 1809 – mor trolig Christiane Guldbrandsen (g. 1810); Gjertrud Brunchorst var 8 år'),
  ('I500441','F500105','F500103','Født 1811 – sønn av Christiane Guldbrandsen, ikke Gjertrud Brunchorst (g. 1820)'),
  ('I500442','F500105','F500103','Født 1813 – sønn av Christiane Guldbrandsen, ikke Gjertrud Brunchorst (g. 1820)'),
  ('I500443','F500105','F500103','Født 1815 – sønn av Christiane Guldbrandsen, ikke Gjertrud Brunchorst (g. 1820)'),
  ('I500444','F500105','F500103','Født 1817 – datter av Christiane Guldbrandsen, ikke Gjertrud Brunchorst (g. 1820)'),
  -- Tallberg: «Bengtsdr.» er døtre av en Bengt, ikke av Johan Fredric (f. 1812)
  ('I500836','F500116','F502008','Bengtsdatter – født da Johan Fredric Tallberg var 13; far er en ukjent Bengt'),
  ('I500837','F500116','F502008','Bengtsdatter – født da Johan Fredric Tallberg var 13; far er en ukjent Bengt'),
  ('I500838','F500116','F502008','Bengtsdatter – født da Johan Fredric Tallberg var 15; far er en ukjent Bengt'),
  ('I500839','F500116','F502008','Bengtsdatter – far er en ukjent Bengt'),
  -- Arnet: barn født 1733–1741 er med første kone (I501326, d. 1741), ikke Christine Heide (f. 1724)
  ('I501330','F500294','F500367','Født ca. 1733 – Christine Heide var 9; første kone døde 1741'),
  ('I501331','F500294','F500367','Født 1734 – første kone'),('I501332','F500294','F500367','Født 1735 – første kone'),
  ('I501333','F500294','F500367','Født 1737 – første kone'),('I501334','F500294','F500367','Født 1739 – første kone'),
  ('I501335','F500294','F500367','Født 1740 – første kone'),('I501336','F500294','F500367','Født 1741 – første kone'),
  -- Aarsæter: datter født 1812, Marte Kolås (f. 1804) ble gift med Anders 1833
  ('I501500','F500397','F502010','Født 1812 – Marte Kolås var 8; mor er en ukjent første kone'),
  -- Wurff: Hans født 1720, Katrine Clodig døde 1708 → andre kone
  ('I502044','F500549','F500500','Født 1720, etter at Katrine Clodig døde 1708 – barn av andre kone'),
  -- Kieding: Johan Nicolay d.y. født 1920 – Kirsten Kielland var 7; mor er første kone (g. 1917)
  ('I502095','F500562','F500527','Født 1920 – mor er første kone (g. 1917), ikke Kirsten Kielland (f. 1913)'),
  -- Finnstad: Lovise født 1757, ni år etter at Gunder Finnstad døde
  ('I502349','F500637','F502012','Født 1757, ni år etter Gunder Finnstads død – far ukjent'),
  -- Hesteflot: barna heter Pedersen/Pedersdatter – far er Peder, ikke Nils (f. 1817)
  ('I501531','F500559','F502013','Pedersøn født 1830 – far er en Peder; Nils Hesteflot var 13'),
  ('I502087','F500559','F502013','Pedersdatter født 1833 – far er en Peder'),
  -- Trampe: Cathinka født 1812 i Trondheim, mens Frederik Christopher Trampe var stiftamtmann der; Frederikke Heinrich døde 1807
  ('I501695','F500454','F500030','Født 1812 i Trondheim – Frederikke Heinrich døde 1807; Trampe giftet seg 1810 med Amalia Schmettau, stiftamtmann i Trondheim fra 1810'),
  -- Cloumann: Elisabeth (1753) er datter av andre kone Elisabeth Holtermann; Elisabeth Fayes barn var Ole (ca. 1746), Peder Jørgen (1747) og Karen (1748)
  ('I500269','F500244','F500246','Født 1753 – Elisabeth Faye døde 1748; mor er andre kone Elisabeth Holtermann (oppkalt etter den første kona)'),
  -- Hveding: barna fra 1721 er magistrat Jens Christensen Hvedings, ikke Jens Danielsens (barn 1710–1716)
  ('I501380','F500321','F502015','Anne Bendicte (døpt 9.8.1721) – datter av Jens Christensen Hveding og Elisabeth Marie Herdal'),
  ('I501069','F500321','F502015','Golla/Gudlaug (1722) – datter av Jens Christensen Hveding og Elisabeth Marie Herdal'),
  ('I501381','F500321','F502015','Fredrikke (ca. 1724) – datter av Jens Christensen Hveding og Elisabeth Marie Herdal'),
  ('I501382','F500321','F502015','Christen (31.1.1731) – sønn av Jens Christensen Hveding og Elisabeth Marie Herdal'),
  ('I501383','F500321','F502015','Jacob (døpt 30.1.1736) – sønn av Jens Christensen Hveding og Elisabeth Marie Herdal');
UPDATE family_children fc SET family_id = m.to_f FROM _mv m WHERE fc.child_id = m.c AND fc.family_id = m.from_f;
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
  SELECT c, 'claude', 'update', 'family_children', 'family_id', from_f, to_f, why FROM _mv;

-- Gran: Else Akkermann (d. 1838) er Jens Grans mor, ikke kona
INSERT INTO family_children (family_id, child_id) VALUES ('F502011','I501985') ON CONFLICT DO NOTHING;
UPDATE families SET wife_id = NULL WHERE family_id = 'F500530' AND wife_id = 'I501986';
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I501986','claude','update','families','Flyttet fra kone til mor av Jens Gran (f. 1832): hun døde 1838, 35 år før «datteren» ble født'),
  ('I501981','claude','update','families','Mor ukjent: Else Akkermann (d. 1838) var farmor, ikke mor');

-- Hesteflot: vielsen 1830 hører til Randis første ekteskap
UPDATE families SET marr_date = NULL WHERE family_id = 'F500559';

-- Fjern koblinger som er rene feil (personen har egen familie andre steder)
DELETE FROM family_children WHERE (child_id, family_id) IN (('I502323','F500638'), ('I500644','F500150'));
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I502323','claude','delete','family_children','Fjernet som barn av Pål Eriksson (f. 1747) – født 1758, da han var 11'),
  ('I500644','claude','delete','family_children','Fjernet som barn av Birgitte Rosing (d. 1704) – står allerede under Anders Bull med annen mor');

-- ---------- Duplikater
INSERT INTO _mg VALUES
  ('I500428','I500414','Margaretha Henricha Dahl (d. 22.10.1836) lå også inne som kone til svigerfaren Johan Martens'),
  ('I500167','I500425','Hans Didrik Martens (f. 22.11.1814) lå inne to ganger'),
  ('I500636','I500642','Rasmus Rosing Bull (1699–1797) lå også inne som navnløs «Rosing»'),
  ('I500616','I500643','Jørgen Andreas Bull (f. 8.10.1703) lå også inne som navnløs «Rosing»'),
  ('I500607','I500615','Amund Eskildsen (f. 1701) lå også inne som barnebarn under farfaren');
DELETE FROM _mg m USING persons p WHERE p.person_id = m.s AND p.is_deleted;
UPDATE families f SET husband_id = m.p FROM _mg m WHERE f.husband_id = m.s;
UPDATE families f SET wife_id = m.p FROM _mg m WHERE f.wife_id = m.s;
DELETE FROM family_children c USING _mg m WHERE c.child_id = m.s
  AND (EXISTS (SELECT 1 FROM family_children x WHERE x.child_id = m.p AND x.family_id = c.family_id) OR c.family_id IN ('F500146','F500150'));
UPDATE family_children c SET child_id = m.p FROM _mg m WHERE c.child_id = m.s;
INSERT INTO person_names (person_id, name_type, given_name, middle_name, surname, prefix, nickname, is_preferred)
  SELECT m.p, n.name_type, n.given_name, n.middle_name, n.surname, n.prefix, n.nickname, false
  FROM person_names n JOIN _mg m ON n.person_id = m.s
  WHERE coalesce(n.given_name,'') <> '' AND NOT EXISTS (SELECT 1 FROM person_names x WHERE x.person_id = m.p
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
-- «Johan Martens + Dahl» står nå som Johan + svigerdatter uten barn → fjernes
DELETE FROM families WHERE family_id = 'F500040' AND NOT EXISTS (SELECT 1 FROM family_children WHERE family_id = 'F500040');

-- ---------- Personer som ikke leder noe sted
INSERT INTO _del VALUES
  ('I501260','Karen Bugge (f. 1840, Lier) sto som barn av Johan Storm Bull (f. 1860) – trolig et annet medlem av husstanden i 1910-tellingen'),
  ('I501004','Karen Sophie Høegh (f. 1753) sto som barn av Peder Cloumann, som døde 1738 – ingen andre koblinger'),
  ('I501696','Navnløs plassholder-ektemann for Frederikke Heinrich');
DELETE FROM _del d WHERE EXISTS (
  SELECT 1 FROM families f JOIN family_children c USING (family_id) WHERE d.pid IN (f.husband_id, f.wife_id));
DELETE FROM family_children WHERE child_id IN (SELECT pid FROM _del);
DELETE FROM families WHERE family_id = 'F500454' AND NOT EXISTS (SELECT 1 FROM family_children WHERE family_id = 'F500454');
UPDATE persons SET is_deleted = true WHERE person_id IN (SELECT pid FROM _del);
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  SELECT pid, 'claude', 'delete', 'persons', 'Fjernet: ' || why FROM _del;

-- ---------- Datoer
-- Olsen: 1802 er skrivefeil for 1902 (søsknene er født 1894–1907)
UPDATE person_facts SET date_text = '30 APR 1902', date_year = 1902, notes = 'Rettet 2026-10-21 fra 1802 – foreldrene født 1849/1861, søsken 1894–1907.'
  WHERE person_id = 'I502308' AND fact_type = 'BIRT' AND date_year = 1802;
-- Tallberg: korporalen kan ikke ha dødd ca. 1800 (9 år gammel) og fått barn 1812–1820
DELETE FROM person_facts WHERE person_id = 'I501061' AND fact_type = 'DEAT' AND date_year = 1800;
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I501061','claude','delete','person_facts','Dødsår «ca. 1800» fjernet – han var født 1791 og fikk barn 1812–1820');
-- Fødselsår som gjør mor til barn
UPDATE person_facts SET date_text = NULL, date_year = NULL,
  notes = coalesce(notes || ' ', '') || '[Rettet 2026-10-21: fødselsår «1799» fjernet – hun ble gift 1806 og fikk barn fra 1806.]'
  WHERE person_id = 'I500897' AND fact_type = 'BIRT' AND date_year = 1799;
-- Cloumann: vielsesdatoen 9.12.1744 hører til ekteskapet med Elisabeth Faye, ikke Holtermann
UPDATE families SET marr_date = NULL WHERE family_id = 'F500246' AND marr_date = '9 DEC 1744';
-- Trampe: gift med Amalia Schmettau 1810 (Wikipedia)
UPDATE families SET marr_date = '1810' WHERE family_id = 'F500030' AND marr_date IS NULL;
-- Wurff: Maren Pedersdatter døde 1683 i Ålum (finnholbek.dk); fødselsåret ca. 1610 ga henne sønn som 61-åring
UPDATE person_facts SET date_text = '1683', date_year = 1683, notes = 'Rettet 2026-10-21 fra 1693 (finnholbek.dk).'
  WHERE person_id = 'I502041' AND fact_type = 'DEAT';
UPDATE person_facts SET date_text = NULL, date_year = NULL,
  notes = '[Rettet 2026-10-21: «ca. 1610» fjernet – sønnen Jens er født 1671.]'
  WHERE person_id = 'I502041' AND fact_type = 'BIRT';
-- Juel: Niels Peter (von) Juul, oberst, oppgis født 1750 også på Geni. Da kan ikke Peder Jensen Juel (d. 1745) og
-- Anna Catharina Bruun (f. 1692) være foreldrene – koblingen merkes, men brytes ikke før det er kildebelagt.
UPDATE person_facts SET notes = coalesce(notes || ' ', '') ||
  '[2026-10-21: Foreldrekoblingen er tvilsom – faren døde 1745 og moren var født 1692. Bør sjekkes mot kilde.]'
  WHERE person_id = 'I501051' AND fact_type = 'BIRT';
-- Henrik Jørgensen Bull: én kone, Ane Andersdatter Holm, mor til alle barna fra ca. 1655 (vestraat.net).
-- Fødselsåret 1647 og vielsen «ca. 1661» er derfor feil.
UPDATE person_facts SET date_text = NULL, date_year = NULL,
  notes = coalesce(notes || ' ', '') || '[Rettet 2026-10-21: fødselsår «1647» fjernet – hun var mor til Dorothea, født ca. 1655.]'
  WHERE person_id = 'I500650' AND fact_type = 'BIRT' AND date_year = 1647;
UPDATE families SET marr_date = NULL WHERE family_id = 'F500152' AND marr_date = 'ABT 1661';
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I500650','claude','update','families','Vielse «ca. 1661» fjernet – første barn født ca. 1655');

-- Anders Henriksen Bull: andre kone Margarethe Mortensdatter (g. 1705) – mor til barna etter 1704
INSERT INTO persons (person_id, sex, is_living) VALUES ('I502388', 'F', false) ON CONFLICT DO NOTHING;
INSERT INTO person_names (person_id, name_type, given_name, surname, is_preferred)
  SELECT 'I502388', 'birth', 'Margarethe', 'Mortensdatter', true WHERE NOT EXISTS (SELECT 1 FROM person_names WHERE person_id = 'I502388');
UPDATE families SET wife_id = 'I502388', marr_date = '1705' WHERE family_id = 'F500151' AND wife_id IS NULL;
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I502388','claude','insert','persons','Lagt inn som Anders Henriksen Bulls andre kone (g. 1705), etter vestraat.net');

-- Wang: Mette Bulls mor Anne Kathrine Tandberg levde 1839–1898 (Wikipedia), ikke 1855–ca. 1875
UPDATE person_facts SET date_text = '1839', date_year = 1839, notes = 'Rettet 2026-10-21 fra 1855 (Wikipedia: Mette Bull).'
  WHERE person_id = 'I501253' AND fact_type = 'BIRT';
UPDATE person_facts SET date_text = '1898', date_year = 1898, notes = 'Rettet 2026-10-21 fra ca. 1875 (Wikipedia: Mette Bull).'
  WHERE person_id = 'I501253' AND fact_type = 'DEAT';
UPDATE families SET marr_date = '18 DEC 1897' WHERE family_id = 'F500350' AND marr_date IS NULL;
UPDATE families SET family_type = 'divorced' WHERE family_id = 'F500350';

-- Martens: Johan Christian døde 1890 ifølge geneanet (treet sa 1895, samme år som broren Hans Didrik)
UPDATE person_facts SET notes = coalesce(notes || ' ', '') || '[Geneanet (Arvid Østbye) oppgir død 1890.]'
  WHERE person_id = 'I500166' AND fact_type = 'DEAT';

-- ---------- Kilder
INSERT INTO person_sources (person_id, archive, title, url, record_type, found_date, found_by, notes)
SELECT * FROM (VALUES
 ('I500161','Geneanet (Arvid Østbye)','Johan Martens (1769–1844)','https://gw.geneanet.org/arvidostbye?lang=fr&n=martens&p=johan','family_history','2026-10-21','Claude',
  '18 barn: 5 med Maren Malene Hagelsteen (1771–1799, g. 10.7.1792) og 13 med Bente Cathrine Hagelsteen (g. 5.11.1799, Korskirken).'),
 ('I502387','Geneanet (Arvid Østbye)','Johan Martens (1769–1844)','https://gw.geneanet.org/arvidostbye?lang=fr&n=martens&p=johan','family_history','2026-10-21','Claude',
  'Første kone til Johan Martens; mor til Johan (1793–95), Hans (1794–1814), Johan (1796–1876), Cathrine Marie (1797–1837) og Didrik Bergmann (1799–1812).')
,
 ('I500433','Wikipedia','Fredrik Glad Balchen','https://en.wikipedia.org/wiki/Fredrik_Glad_Balchen','encyclopedia','2026-10-21','Claude',
  'Fredrik Glad Balchen født 6.4.1815 i Bergen, sønn av kapellan Johan Peter Balchen (1783–1827) og Christiane Wilhelmine Gulbrandsen (1789–1819).'),
 ('I500098','Wikipedia','Frederich Christopher Trampe, Count of Trampe','https://en.wikipedia.org/wiki/Frederich_Christopher_Trampe,_Count_of_Trampe','encyclopedia','2026-10-21','Claude',
  'Gift 1797 Sophie Frederikke Heinrich (1764–1807), 1808 Anna Dorothea Colbjørnsen (1792–1808), 1810 Amalia Ulrica Frederike Schmettau (1790–1856). Stiftamtmann i Søndre Trondhjems amt 1810–1832.'),
 ('I501874','finnholbek.dk','Jens Mortensen Wurff (1671–1735)','https://finnholbek.dk/getperson.php?personID=I24787&tree=2','family_history','2026-10-21','Claude',
  'Foreldre Morten Wurff og Maren Pedersdatter (d. 1683, Ålum). Gift 19.8.1704 med Kathrine Olesdatter Clodig (d. apr. 1708): Charlotte Amalie 1705, Christian Ludvig 1707. Gift før 1712 med Anne Hansdatter Mossin (1678–1773): Charlotte Amalie 1716, Hans 1720.'),
 ('I500998','Hemneslekt','Claus Pedersen Cloumann (1717–1783)','https://hemneslekt.net/getperson.php?personID=I99656&tree=Hemne','family_history','2026-10-21','Claude',
  'Gift 9.12.1744 med Elisabeth Faye (1714–1748): Ole ca. 1746, Peder Jørgen 1747, Karen 1748. Andre kone Elisabeth Carstensdatter Holtermann (1716–1808).'),
 ('I502389','vestraat.net','Etterkommere etter Christen Jensen Hveding','https://vestraat.net/ettersl/hveding0001.htm','family_history','2026-10-21','Claude',
  'Jens Christensen Hveding, f. 1691 Hamarøy, d. 1758, magistrat i Trondheim. Gift 17.7.1720 med Elisabeth Marie Pedersdatter Herdal. 12 barn 1721–1736, bl.a. Anne Bendicte, Golla, Fredrikke, Christen (1731) og Jacob (1736).'),
 ('I501168','vestraat.net','Etterkommere etter Christen Jensen Hveding','https://vestraat.net/ettersl/hveding0001.htm','family_history','2026-10-21','Claude',
  'Jens Danielsen Hveding gift ca. 1710 med Dorothea Andersdatter Brønlund. Barn: Jens Andreas ca. 1710, Birgitthe 1711, Maren 1713, Riborg 1714, Margaretha ca. 1716.'),
 ('I500647','vestraat.net','Etterkommere etter Jens Andersen Bull','https://vestraat.net/ettersl/bull0001.htm','family_history','2026-10-21','Claude',
  'Gift med Ane Andersdatter Holm. Barn: Anna (d. 1702), Dorothea (ca. 1655–1726), Elen (ca. 1660–1696), Anders (1663–1735), Margrete (ca. 1665), Martha (ca. 1670–ca. 1718).'),
 ('I500631','vestraat.net','Etterkommere etter Jens Andersen Bull','https://vestraat.net/ettersl/bull0001.htm','family_history','2026-10-21','Claude',
  'Gift 1692 (Hitra) med Birgitte Rasmusdatter Rosing, 1705 med Margarethe Mortensdatter.'),
 ('I501251','Wikipedia','Mette Bull','https://en.wikipedia.org/wiki/Mette_Bull','encyclopedia','2026-10-21','Claude',
  'Født 31.1.1876 i Christiania, datter av kjøpmann Hans Emanuel Wang (1839–1918) og Anne Kathrine Tandberg (1839–1898). Gift 18.12.1897 med operasanger Jens Elias Berntsen (oppløst), 8.5.1905 med arkitekt Henrik Bull.')
) v(person_id, archive, title, url, record_type, found_date, found_by, notes)
WHERE NOT EXISTS (SELECT 1 FROM person_sources s WHERE s.person_id = v.person_id AND s.url = v.url);

COMMIT;

-- Kontroll: gjenstående avvik i hele treet (forventet: bare de som er bevisst latt stå)
WITH b AS (SELECT person_id, min(date_year) y FROM person_facts WHERE fact_type='BIRT' AND date_year IS NOT NULL GROUP BY 1),
     d AS (SELECT person_id, min(date_year) y FROM person_facts WHERE fact_type='DEAT' AND date_year IS NOT NULL GROUP BY 1)
SELECT f.family_id, fc.child_id, cb.y barn_f, wb.y mor_f, wd.y mor_d, hb.y far_f, hd.y far_d
FROM families f JOIN family_children fc USING (family_id) JOIN persons p ON p.person_id = fc.child_id AND NOT p.is_deleted
JOIN b cb ON cb.person_id = fc.child_id
LEFT JOIN b wb ON wb.person_id = f.wife_id LEFT JOIN d wd ON wd.person_id = f.wife_id
LEFT JOIN b hb ON hb.person_id = f.husband_id LEFT JOIN d hd ON hd.person_id = f.husband_id
WHERE cb.y - wb.y < 14 OR cb.y > wd.y OR cb.y > hd.y + 1 OR cb.y - hb.y < 14 OR cb.y - wb.y > 52
ORDER BY 1;
