-- ============================================================
-- Datarettinger 21.10.2026, del 4 — funn fra nettlesersjekken
--   * Oldenburg-navn: kongebarna fikk «von»/«af»/«von Dänemark-Norwegen (Oldenburg)» om hverandre
--   * Christian IVs søsken Hedvig og Hans sto med «Gyldenløve af Danmark» (de var ektefødte)
--   * Anton I og II var greve av Aldenburg, ikke Oldenburg
--   * Ulrik Christian Gyldenløve manglet datoer; «vielse» med Vibeke Kruse fjernes
--   * Christian IVs AI-biografi hadde feil og manglende æøå
-- ============================================================
BEGIN;

-- Danske kongebarn: etternavn Oldenburg, ingen partikkel
UPDATE person_names SET prefix = NULL, surname = 'Oldenburg'
WHERE is_preferred AND person_id IN ('I501400','I501401','I501471','I501472','I501475','I501476','I501548','I501341','I501441','I501418','I501444');

-- Hedvig (1581–1641), kurfyrstinne av Sachsen, og Hans (1583–1602) var ektefødte barn av Frederik II
UPDATE person_names SET surname = 'Oldenburg' WHERE is_preferred AND person_id = 'I501421';
UPDATE person_names SET given_name = 'Hans' WHERE is_preferred AND person_id = 'I501422' AND given_name = 'Johan(Hans)';

-- «Hans Gyldenløve af Danmark» (I501423) er samme person som Hans Oldenburg (I501422): samme fødsels- og dødsdato
CREATE TEMP TABLE _mg (p text, s text, why text) ON COMMIT DROP;
INSERT INTO _mg VALUES ('I501422','I501423','Hans (1583–1602), Christian IVs bror, lå inne to ganger – én gang feilaktig som «Gyldenløve»');
DELETE FROM _mg m USING persons p WHERE p.person_id = m.s AND p.is_deleted;
UPDATE families f SET husband_id = m.p FROM _mg m WHERE f.husband_id = m.s;
UPDATE families f SET wife_id = m.p FROM _mg m WHERE f.wife_id = m.s;
DELETE FROM family_children c USING _mg m WHERE c.child_id = m.s
  AND EXISTS (SELECT 1 FROM family_children x WHERE x.child_id = m.p AND x.family_id = c.family_id);
UPDATE family_children c SET child_id = m.p FROM _mg m WHERE c.child_id = m.s;
UPDATE person_sources so SET person_id = m.p FROM _mg m WHERE so.person_id = m.s;
UPDATE person_roles r SET person_id = m.p FROM _mg m WHERE r.person_id = m.s
  AND NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = m.p AND (x.role_id = r.role_id OR x.value = r.value));
UPDATE person_photos ph SET person_id = m.p, is_primary = false FROM _mg m WHERE ph.person_id = m.s;
UPDATE person_biography b SET person_id = m.p FROM _mg m
  WHERE b.person_id = m.s AND NOT EXISTS (SELECT 1 FROM person_biography x WHERE x.person_id = m.p);
UPDATE persons ps SET is_deleted = true FROM _mg m WHERE ps.person_id = m.s;
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
  SELECT s, 'claude', 'delete', 'persons', 'Slått sammen med ' || p || ': ' || why FROM _mg
  UNION ALL SELECT p, 'claude', 'update', 'persons', 'Overtok data fra duplikat ' || s || ': ' || why FROM _mg;

-- Anton I og Anton II: grever av Aldenburg
UPDATE person_names SET surname = 'Aldenburg', prefix = 'von' WHERE is_preferred AND person_id IN ('I501349','I501657');

-- Ulrik Christian Gyldenløve (1630–1658), sønn av Christian IV og Vibeke Kruse
INSERT INTO person_facts (person_id, fact_type, date_text, date_year, date_month, date_day, place_raw)
SELECT * FROM (VALUES
  ('I501443','BIRT','7 APR 1630',1630,4,7,NULL),
  ('I501443','DEAT','11 DEC 1658',1658,12,11,NULL)) v(a,b,c,d,e,f,g)
WHERE NOT EXISTS (SELECT 1 FROM person_facts WHERE person_id = 'I501443' AND fact_type IN ('BIRT','DEAT'));
-- Christian IV og Vibeke Kruse var ikke gift – stedet «Frederiksborg» ga en udatert «vielse» i tidslinjen
UPDATE families SET marr_place_raw = NULL, marr_date = NULL WHERE family_id = 'F500388';
DELETE FROM person_facts WHERE fact_type = 'MARR' AND person_id IN ('I501384','I501442') AND date_year IS NULL
  AND coalesce(place_raw,'') ILIKE '%Frederiksborg%';

-- Christian IV: biografi uten feil (fortsatt merket som AI-generert, ikke godkjent)
UPDATE person_biography SET biography_text =
$b$Christian IV (1577–1648) var konge av Danmark og Norge fra 1588 til 1648 – den lengste regjeringstiden i Oldenburg-ætten. Han ble konge som barn, og en formynderregjering styrte til han ble kronet i 1596.

Han er kjent som byggekongen: Etter bybrannen i Oslo i 1624 flyttet han byen inn under Akershus og ga den navnet Christiania. Han grunnla Kongsberg (1624) og Kristiansand (1641), og sto bak Christianshavn, Rosenborg, Børsen og Rundetårn. Krigene gikk dårligere. Etter nederlaget ved Lutter am Barenberge i 1626 under trettiårskrigen og Torstensson-krigen 1643–45 måtte han ved freden i Brømsebro i 1645 avstå Jämtland, Härjedalen og Gotland og pantsette Halland. I sjøslaget på Kolberger Heide i 1644 mistet han synet på høyre øye.

Han var gift med <a href="/person/I501398">Anna Katharina av Brandenburg</a> (død 1612), som var mor til blant andre <a href="/person/I501341">Frederik III</a>, og deretter morganatisk med <a href="/person/I501403">Kirsten Munk</a>. Med frillene <a href="/person/I501413">Karen Andersdatter</a> og <a href="/person/I501442">Vibeke Kruse</a> fikk han flere barn med navnet Gyldenløve.$b$,
  updated_by = 'Claude'
WHERE person_id = 'I501384' AND NOT is_approved;

INSERT INTO person_sources (person_id, archive, title, url, record_type, found_date, found_by, notes)
SELECT * FROM (VALUES
 ('I501384','Store norske leksikon','Christian 4','https://snl.no/Christian_4','encyclopedia','2026-10-21','Claude','Grunnlag for biografien.'),
 ('I501443','Lex.dk','Ulrik Christian Gyldenløve – søn af Christian 4.','https://lex.dk/Ulrik_Christian_Gyldenl%C3%B8ve_-_s%C3%B8n_af_Christian_4.','encyclopedia','2026-10-21','Claude','Født 7.4.1630, død 11.12.1658, sønn av Christian IV og Vibeke Kruse.')
) v(person_id, archive, title, url, record_type, found_date, found_by, notes)
WHERE NOT EXISTS (SELECT 1 FROM person_sources s WHERE s.person_id = v.person_id AND s.url = v.url);

COMMIT;

SELECT person_id, concat_ws(' ', given_name, middle_name, prefix, surname) AS navn
FROM person_names WHERE is_preferred AND person_id IN ('I501400','I501341','I501421','I501422','I501349','I501657','I501443')
ORDER BY 1;
