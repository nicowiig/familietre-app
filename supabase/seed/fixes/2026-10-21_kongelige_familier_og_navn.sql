-- ============================================================
-- Datarettinger 21.10.2026
--   1. Barn plassert under feil mor i kongelige/adelige grener
--      (Christian IV, Frederik III, Ulrik Frederik Gyldenløve, Woldemar Løvendal)
--   2. Duplikater slått sammen (Junger, Dorothea Elisabeth, Anna Kathrine, Margrethe)
--   3. Frille som rolle, Pape som utnevnt baronesse, Junger sine grader
--   4. Titler fjernet fra navnefelt (de ligger nå som roller), partikler til prefix
--   5. Biografier
-- Kjøres som én transaksjon: enten går alt gjennom, eller ingenting.
-- ============================================================
BEGIN;

CREATE TEMP TABLE _mv (c text, from_f text, to_f text) ON COMMIT DROP;
CREATE TEMP TABLE _mg (p text, s text, why text) ON COMMIT DROP;

-- ---------- 1. Koblinger som skal bort (ikke flyttes)
DELETE FROM family_children WHERE (child_id, family_id) IN
  (('I501404','F500382'),('I501415','F500384'),('I501071','F500270'),('I501469','F500391'));

-- ---------- Nye personer og familier
INSERT INTO families (family_id, husband_id, wife_id, family_type)
  VALUES ('F502005', 'I501188', NULL, 'married') ON CONFLICT DO NOTHING;              -- Gyldenløve + ukjent mor (Junger)
INSERT INTO persons (person_id, sex, is_living) VALUES ('I502386', 'F', false) ON CONFLICT DO NOTHING;
INSERT INTO person_names (person_id, name_type, given_name, surname, is_preferred)
  SELECT 'I502386', 'birth', 'Sophie Amalie', 'Braunschweig-Lüneburg', true
  WHERE NOT EXISTS (SELECT 1 FROM person_names WHERE person_id = 'I502386');
INSERT INTO person_facts (person_id, fact_type, date_text, date_year, date_month, date_day, place_raw)
  SELECT * FROM (VALUES
    ('I502386', 'BIRT', '24 MAR 1628', 1628, 3, 24, 'Herzberg am Harz, Tyskland'),
    ('I502386', 'DEAT', '20 FEB 1685', 1685, 2, 20, 'København, Danmark')) v
  WHERE NOT EXISTS (SELECT 1 FROM person_facts WHERE person_id = 'I502386');
INSERT INTO families (family_id, husband_id, wife_id, marr_date, marr_place_raw, family_type)
  VALUES ('F502004', 'I501341', 'I502386', '1 OCT 1643', 'Glücksburg', 'married') ON CONFLICT DO NOTHING;
INSERT INTO family_children (family_id, child_id) VALUES ('F500369', 'I501071') ON CONFLICT DO NOTHING;

-- ---------- Flytt barn til riktig mor
INSERT INTO _mv VALUES
  -- Junger: ukjent mor (ikke Maria Meng)
  ('I501462','F500391','F502005'), ('I501461','F500391','F502005'),
  -- Hans Ulrik Gyldenløve: sønn av Karen Andersdatter, ikke Kirsten Munk
  ('I501437','F500382','F500384'),
  -- Frederik IIIs ektefødte barn: dronning Sophie Amalie, ikke Margrethe Pape
  ('I501470','F500368','F502004'),('I501471','F500368','F502004'),('I501472','F500368','F502004'),('I501473','F500368','F502004'),
  ('I501474','F500368','F502004'),('I501476','F500368','F502004'),('I501475','F500368','F502004'),
  -- Ulrik Frederik Gyldenløves barn med Antoinette Augusta av Aldenburg (SNL: ni barn)
  ('I501463','F500391','F500369'),('I501464','F500391','F500369'),('I501465','F500391','F500369'),('I501467','F500391','F500369'),
  ('I501466','F500391','F500369'),('I501460','F500391','F500369'),('I501468','F500391','F500369'),('I501457','F500331','F500369'),
  -- Woldemar Løvendals barn med Dorothea Brockdorff (gift 1687), ikke Benedicte Rantzau (gift 1709)
  ('I500685','F500270','F500332'),('I501073','F500270','F500332'),('I501072','F500270','F500332');
UPDATE family_children fc SET family_id = m.to_f FROM _mv m WHERE fc.child_id = m.c AND fc.family_id = m.from_f;
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, field_name, old_value, new_value, note)
  SELECT c, 'claude', 'update', 'family_children', 'family_id', from_f, to_f, 'Flyttet til riktig mor etter kildesjekk' FROM _mv;

-- ---------- 2. Slå sammen duplikater (sekundær -> primær), samme logikk som Duplikat-siden
INSERT INTO _mg VALUES
  ('I501462','I501461','Peter Frederich Junger lå inne to ganger (Geni-import)'),
  ('I501414','I501404','Dorothea Elisabeth (1613–1615) lå inne med tittel som navn og feil mor (Kirsten Munk)'),
  ('I501405','I501415','Anna Kathrine (1618–1633) lå inne to ganger, én gang under feil mor'),
  ('I501071','I501469','Margrethe Christiane Auguste (1694–1761) lå inne to ganger');
DELETE FROM _mg m USING persons p WHERE p.person_id = m.s AND p.is_deleted;   -- allerede slått sammen
UPDATE person_facts SET date_text='20 DEC 1613', date_year=1613, date_month=12, date_day=20, place_raw='Koldinghus, Kolding, Danmark'
  WHERE person_id='I501414' AND fact_type='BIRT';
UPDATE person_facts SET date_text='3 JAN 1615', date_year=1615, date_month=1, date_day=3
  WHERE person_id='I501414' AND fact_type='DEAT';
UPDATE families f SET husband_id = m.p FROM _mg m WHERE f.husband_id = m.s;
UPDATE families f SET wife_id = m.p FROM _mg m WHERE f.wife_id = m.s;
DELETE FROM family_children c USING _mg m
  WHERE c.child_id = m.s AND EXISTS (SELECT 1 FROM family_children x WHERE x.child_id = m.p AND x.family_id = c.family_id);
UPDATE family_children c SET child_id = m.p FROM _mg m WHERE c.child_id = m.s;
INSERT INTO person_names (person_id, name_type, given_name, middle_name, surname, prefix, nickname, is_preferred)
  SELECT m.p, n.name_type, n.given_name, n.middle_name, n.surname, n.prefix, n.nickname, false
  FROM person_names n JOIN _mg m ON n.person_id = m.s
  WHERE n.surname IS DISTINCT FROM 'Konge af Danmark-Norge' AND n.prefix IS DISTINCT FROM 'Graf'
    AND NOT EXISTS (SELECT 1 FROM person_names x WHERE x.person_id = m.p
      AND coalesce(x.given_name,'')||coalesce(x.middle_name,'')||coalesce(x.surname,'') = coalesce(n.given_name,'')||coalesce(n.middle_name,'')||coalesce(n.surname,''));
INSERT INTO person_facts (person_id, fact_type, date_text, date_year, date_month, date_day, place_raw, notes, place_city, place_region, place_country)
  SELECT m.p, f.fact_type, f.date_text, f.date_year, f.date_month, f.date_day, f.place_raw, f.notes, f.place_city, f.place_region, f.place_country
  FROM person_facts f JOIN _mg m ON f.person_id = m.s
  WHERE NOT EXISTS (SELECT 1 FROM person_facts x WHERE x.person_id = m.p AND x.fact_type = f.fact_type AND x.date_year IS NOT DISTINCT FROM f.date_year);
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

-- ---------- 3. Roller
-- Junger: grader fra Ovenstad
INSERT INTO role_catalog (name, category, social_group, rank_order, period, context, description)
VALUES ('Fenrik', 'military_rank', 'Offiserer', 25, '1600-tallet–', 'Danmark-Norge',
        'Laveste offisersgrad; bar opprinnelig kompaniets fane (fenrik = fanebærer). Under sekondløytnant.')
ON CONFLICT (name) DO NOTHING;
UPDATE role_catalog SET parent_id = (SELECT id FROM role_catalog WHERE name = 'Løytnant') WHERE name = 'Fenrik';
DELETE FROM person_roles WHERE person_id = 'I501462' AND value = 'Offiser';
INSERT INTO person_roles (person_id, role_type, value, place, date_from, date_to, role_id, source)
SELECT 'I501462', 'military_rank', rc.name, v.place, v.dfrom, v.dto, rc.id, 'Ovenstad, Militærbiografier (via Nasjonalarkivets forum)'
FROM (VALUES ('Fenrik','Akershusiske regiment',NULL,'1734'), ('Sekondløytnant','Akershusiske regiment','1734',NULL),
             ('Premierløytnant','Akershusiske regiment','1740',NULL), ('Løytnant','Numedalske kompani','1741','1745')) v(canon, place, dfrom, dto)
JOIN role_catalog rc ON rc.name = v.canon
WHERE NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = 'I501462' AND x.role_id = rc.id);
UPDATE person_facts SET notes = 'Druknet. Ovenstad: død før august 1745.' WHERE person_id = 'I501462' AND fact_type = 'DEAT';

-- Pape: baronesse ved utnevnelse 1683, riktig dødsår
UPDATE person_facts SET date_text='1684', date_year=1684, notes='Rettet fra 1704 (Wikipedia: 1620–1684).'
  WHERE person_id='I501342' AND fact_type='DEAT';
UPDATE person_roles SET acquired_by='utnevnelse', date_from='1683', reason='Tittelen ble gitt av Christian V i 1683.'
  WHERE person_id='I501342' AND value='Baronesse';

-- Frille som rolle
UPDATE role_catalog SET name = 'Frille',
  description = 'Kongens eller en høytstående manns elskerinne utenfor ekteskap – en kjent og nærmest offisiell posisjon. Barna ble ofte anerkjent, fikk navn som Gyldenløve og kunne bli adlet.'
  WHERE name = 'Elskerinne (kongelig)';
UPDATE person_roles SET value = 'Frille' WHERE role_id = (SELECT id FROM role_catalog WHERE name = 'Frille');
INSERT INTO title_glossary (original, modern_norwegian, role_id, explanation_no)
  SELECT 'Elskerinne (kongelig)', 'Frille', id, description FROM role_catalog WHERE name = 'Frille'
  ON CONFLICT ((lower(original))) DO NOTHING;
INSERT INTO person_roles (person_id, role_type, value, date_from, role_id, reason, source)
SELECT v.pid, 'other', 'Frille', v.dfrom, rc.id, v.why, 'Utledet 2026-10-21'
FROM (VALUES ('I501342','ca. 1637','Frille av kronprins Frederik (senere Frederik III).'),
             ('I501413','ca. 1612','Frille av Christian IV.'),
             ('I501458','ca. 1691','Frille av stattholder Ulrik Frederik Gyldenløve.')) v(pid, dfrom, why)
JOIN role_catalog rc ON rc.name = 'Frille'
WHERE NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = v.pid AND x.role_id = rc.id);

-- Dronning Sophie Amalie
INSERT INTO person_roles (person_id, role_type, value, date_from, role_id, acquired_by, source)
SELECT 'I502386', 'title', rc.name, '1648', rc.id, 'ekteskap', 'Wikipedia' FROM role_catalog rc
WHERE rc.name = 'Dronning' AND NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = 'I502386' AND x.role_id = rc.id);

-- Kirsten Munks barn bar tittelen greve/grevinne af Slesvig og Holsten (fra navnene)
INSERT INTO person_roles (person_id, role_type, value, place, role_id, acquired_by, original_value, source)
SELECT fc.child_id, 'title', rc.name, 'Slesvig og Holsten', rc.id, 'fødsel', 'af Slesvig og Holsten', 'Utledet fra navn 2026-10-21'
FROM family_children fc JOIN persons p ON p.person_id = fc.child_id AND NOT p.is_deleted
JOIN role_catalog rc ON rc.name = CASE WHEN p.sex = 'M' THEN 'Greve' ELSE 'Grevinne' END
WHERE fc.family_id = 'F500382'
  AND NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = fc.child_id AND x.role_id = rc.id);

-- Løvendal: Brockdorff-ekteskapet
UPDATE families SET marr_date = '1687' WHERE family_id = 'F500332';
UPDATE person_facts SET date_text='1706', date_year=1706, date_month=NULL, date_day=NULL,
  notes='Rettet fra 29 JAN 1709 (samme dato som Woldemars andre bryllup – kopieringsfeil). Wikipedia: død 1706.'
  WHERE person_id='I501191' AND fact_type='DEAT';

-- ---------- 4. Navn: titler ut (de ligger som roller), partikler til prefix
UPDATE person_names n SET given_name = v.g, middle_name = v.m, surname = v.s, prefix = v.p
FROM (VALUES
  ('I501462','Peter Frederich',NULL,'Junger',NULL),
  ('I501071','Margrethe','Christiane Auguste','Gyldenløve',NULL),
  ('I500404','Amalie','Hedevig','Trampe',NULL),
  ('I500509','Johan Fredrik',NULL,'Schwabe',NULL),
  ('I500618','Johan','Nielsen','Randulf',NULL),
  ('I500685','Hedevig',NULL,'Løvendal',NULL),
  ('I501067','Benedicte','Margrethe','Rantzau','von'),
  ('I501178','Jens',NULL,'Christensen Hveding',NULL),
  ('I501351','Dorothea','Justine','Aldenburg','von'),
  ('I501420','Augusta',NULL,'Oldenburg',NULL),
  ('I501546','Barbara Sophie',NULL,'Hohenzollern','von'),
  ('I501661','Niels','Andersen','Brønlund',NULL),
  ('I501699','Fredrik','Waldemar','Trampe',NULL),
  ('I501701','Aline','Louise Emilie Caroline','Trampe',NULL),
  ('I501725','Otto','Christophersen','Munthe',NULL),
  ('I501738','Elisabeth',NULL,'Hohenzollern','von'),
  ('I502134','Elisabeth',NULL,'Habsburg','von'),
  ('I502139','Aleksander',NULL,'Jagiellon',NULL),
  ('I502140','Zofia',NULL,'Jagiellon',NULL),
  ('I502154','Christina',NULL,'Sachsen','von'),
  ('I501526','Bredo',NULL,'Munthe af Morgenstierne',NULL),
  ('I501574','Katharine',NULL,'Braunschweig-Wolfenbüttel','von'),
  ('I501579','Elisabeth','Sophie','Hohenzollern','von'),
  ('I502272','Anna',NULL,'Habsburg','von'),
  ('I500688','Carl','Leopold Gottfried','Schmettow','von'),
  ('I500686','Georgine','Amalie','Croix de Fréchapelle','de la')
) v(pid, g, m, s, p)
WHERE n.person_id = v.pid AND n.is_preferred;

-- de gamle formene bevares som alternativt navn der de inneholdt mer enn tittel (f.eks. litauiske/polske navneformer)
INSERT INTO person_names (person_id, name_type, given_name, middle_name, surname, is_preferred)
SELECT * FROM (VALUES
  ('I502134','also_known_as','Elzbieta','Rakuszanka',NULL, false),
  ('I502140','also_known_as','Zofia',NULL,'Jagiellonka', false)) v(pid, t, g, m, s, pref)
WHERE NOT EXISTS (SELECT 1 FROM person_names x WHERE x.person_id = v.pid AND x.name_type = 'also_known_as');

-- partikler: små bokstaver, og ingen dobbel partikkel når etternavnet har én («Munthe af Morgenstierne»)
UPDATE person_names SET prefix = lower(prefix) WHERE prefix ~ '^(Von|Af|De|Zu|Van)$';
UPDATE person_names SET prefix = NULL
  WHERE prefix IN ('von','af','de') AND surname ~* '(^|\s)(von|af|de|zu)(\s|$)';
-- partikkel som ligger sist i mellomnavnet («Waldemare von» + «Trampe»)
UPDATE person_names SET prefix = lower(substring(middle_name from '(?i)\s(von|af)$')),
       middle_name = nullif(trim(regexp_replace(middle_name, '(?i)\s(von|af)$', '')), '')
  WHERE middle_name ~* '\s(von|af)$' AND prefix IS NULL;

-- ---------- 5. Biografier (AI-generert, ikke godkjent)
INSERT INTO person_biography (person_id, biography_text, is_ai_generated, is_approved, updated_by)
SELECT v.pid, v.txt, true, false, 'Claude' FROM (VALUES
('I501462', $b$Peter Frederich Junger (1691 – 1745) var offiser i den dansk-norske hæren og en uekte sønn av stattholder <a href="/person/I501188">Ulrik Frederik Gyldenløve</a>. Militærrullen oppgir Gyldenløve som far; moren er ikke kjent.

Ifølge Ovenstads militærbiografier var han fenrik og sekondløytnant i Akershusiske regiment fra 1734, premierløytnant fra 1740 og løytnant ved Numedalske kompani fra 1741. I 1742 flyttet han til Rollag i Numedal, og han druknet før august 1745.

Han var gift med Anne Cathrine Bruun (1697–1764), muligens av Bruun-slekten på Bragernes. Et barn ble døpt i Asker i 1738.

Kildekritisk merknad: Geni-importen hadde ham med tittelen «Graf» og lå inne to ganger. Ingen kilde støtter en grevetittel – den kom trolig av at faren var stattholder og greve. Duplikatet ble slått sammen og tittelen fjernet 21. oktober 2026.$b$),
('I501414', $b$Dorothea Elisabeth Gyldenløve (20. desember 1613 – 3. januar 1615) var datter av kong <a href="/person/I501384">Christian IV</a> og hans frille <a href="/person/I501413">Karen Andersdatter</a>. Hun ble født på Koldinghus og døde litt over ett år gammel. Hennes bror var <a href="/person/I501437">Hans Ulrik Gyldenløve</a> (1615–1645).

Som frillebarn fikk hun navnet Gyldenløve, som Christian IV og senere konger ga sine anerkjente barn utenfor ekteskap.

Kildekritisk merknad: Hun lå også inne som en egen person med «Konge af Danmark-Norge» som navn, oppført som datter av Kirsten Munk. Duplikatet ble slått sammen 21. oktober 2026.$b$),
('I501342', $b$Margrethe Pape (1620 – 1684) var en tysk adelsdame fra Holsten og frille av kronprins Frederik, senere kong <a href="/person/I501341">Frederik III</a>, før han giftet seg og ble konge. Sammen fikk de sønnen <a href="/person/I501188">Ulrik Frederik Gyldenløve</a> (1638–1704), som ble stattholder i Norge – og gjennom ham går slektslinjen videre til Løvendal, Schmettow og Trampe.

Senere ble hun gift med Daniel Hausmann (d. 1670), amtsforvalter i Segeberg og etatsråd. I 1683 ga kong Christian V henne tittelen baronesse af Løvendal – samme navn som barnebarna Woldemar og Carl hadde fått året før.

Kildekritisk merknad: Importen hadde henne som mor til alle Frederik IIIs ektefødte barn, blant dem Christian V. De ble 21. oktober 2026 flyttet til dronning Sophie Amalie av Braunschweig-Lüneburg. Dødsåret ble rettet fra 1704 til 1684.$b$),
('I502386', $b$Sophie Amalie av Braunschweig-Lüneburg (1628 – 1685) var dronning av Danmark og Norge, gift 1643 med <a href="/person/I501341">Frederik III</a>. Hun var mor til blant andre Christian V. Hun ble lagt inn i treet 21. oktober 2026 fordi barna hennes feilaktig sto oppført med kongens frille Margrethe Pape som mor.$b$)
) v(pid, txt)
WHERE NOT EXISTS (SELECT 1 FROM person_biography b WHERE b.person_id = v.pid);

-- ---------- Kilder
INSERT INTO person_sources (person_id, archive, title, url, record_type, relevance, found_date, found_by, notes)
SELECT * FROM (VALUES
 ('I501462','Nasjonalarkivets brukerforum','Peter Frederich Junger, born 1691, military, lived in Rollag, Buskerud',
  'https://forum.nasjonalarkivet.no/topic/95520-9605-peter-frederich-junger-born-in-1691-military-lived-in-rollag-buskerud/','forum','primary','2026-10-21','Claude',
  'Militærrullen oppgir Ulrik Frederik Gyldenløve som far. Ovenstad: fenrik/sekondløytnant i Akershusiske regiment 1734, premierløytnant 1740, løytnant ved Numedalske kompani 1741, druknet før aug. 1745. Gift med Anne Cathrine Bruun (1697–1764). Ingen kilde for grevetittel.'),
 ('I502386','Wikipedia','Sophie Amalie of Brunswick-Lüneburg','https://en.wikipedia.org/wiki/Sophie_Amalie_of_Brunswick-L%C3%BCneburg','encyclopedia',NULL,'2026-10-21','Claude',
  'Opprettet fordi Frederik IIIs ektefødte barn feilaktig sto oppført med Margrethe Pape som mor.'),
 ('I501342','Wikipedia','Margrethe Pape','https://en.wikipedia.org/wiki/Margrethe_Pape','encyclopedia',NULL,'2026-10-21','Claude',
  '1620–1684. Frille av Frederik III før han ble konge; mor til Ulrik Frederik Gyldenløve. Senere gift med Daniel Hausmann (d. 1670), amtsforvalter i Segeberg. Baronesse af Løvendal 1683.'),
 ('I501414','Wikipedia','Karen Andersdatter','https://en.wikipedia.org/wiki/Karen_Andersdatter','encyclopedia',NULL,'2026-10-21','Claude',
  'Karen Andersdatter og Christian IV fikk Dorothea Elisabeth Gyldenløve (1613–1615) og Hans Ulrik Gyldenløve (1615–1645).'),
 ('I500685','Wikipedia','Woldemar Løvendal','https://en.wikipedia.org/wiki/Woldemar_L%C3%B8vendal','encyclopedia',NULL,'2026-10-21','Claude',
  'Mor er Dorothea Margrethe Brockdorff (gift 1687, død 1706). Andre kone Benedicte Margrethe Rantzau (gift 1709) fikk fire barn som alle døde som spedbarn.'),
 ('I501188','Store norske leksikon','Ulrik Frederik Gyldenløve','https://snl.no/Ulrik_Frederik_Gyldenløve','encyclopedia',NULL,'2026-10-21','Claude',
  'Hemmelig gift 1659 med Sophie Urne (sønnene Løvendal), 1660–70 med Marie Grubbe (barnløst), 1677 med Antoinette Augusta av Aldenburg (ni barn). Uekte sønn Wilhelm de Ulrichsdal med Marie Meng.')
) v(person_id, archive, title, url, record_type, relevance, found_date, found_by, notes)
WHERE NOT EXISTS (SELECT 1 FROM person_sources s WHERE s.person_id = v.person_id AND s.url = v.url);

COMMIT;

-- Kontroll (vises etter kjøring)
SELECT f.family_id, coalesce(f.husband_id,'-') || ' + ' || coalesce(f.wife_id,'ukjent mor') AS foreldre, f.marr_date,
  count(fc.child_id) AS barn
FROM families f LEFT JOIN family_children fc USING (family_id)
WHERE f.family_id IN ('F500368','F502004','F500382','F500384','F500369','F500391','F500331','F502005','F500270','F500332')
GROUP BY 1,2,3 ORDER BY 1;
