-- ============================================================
-- 2026-10-21 · 13
--   A. «Aasen» og «Bestumaasen» er samme sted: Bestumåsen, i dag Bestumveien 3 (Georg Andreas Bulls siste hjem)
--   B. Dobbeltpersoner: Wilhelmine Martens Bull Wiig (f. 16.12.1902), Wilhelmine Kristiane Wiig (1870–1871)
-- Kan kjøres uavhengig av SQL 12.
-- ============================================================
BEGIN;

-- ---------- A. Bestumåsen
UPDATE person_facts SET place_id = 648 WHERE place_id = 921;
UPDATE address_periods SET address_id = 648 WHERE address_id = 921;
UPDATE families SET marr_place_id = 648 WHERE marr_place_id = 921;
UPDATE place_articles SET address_id = 648 WHERE address_id = 921;
UPDATE place_aliases SET address_id = 648 WHERE address_id = 921
  AND NOT EXISTS (SELECT 1 FROM place_aliases x WHERE x.address_id = 648 AND x.name_variant = place_aliases.name_variant);
DELETE FROM place_name_periods WHERE address_id = 921;
DELETE FROM place_jurisdictions WHERE address_id = 921;
DELETE FROM place_aliases WHERE address_id = 921;
DELETE FROM addresses WHERE id = 921;
-- Koordinatene pekte på Råde (feiltreff). Bestum brukes til et presist punkt er satt.
UPDATE addresses SET
  name_short = 'Bestumåsen',
  name_display = 'Bestumåsen, Bestumveien 3, Oslo',
  building_name = 'Villa Åsen',
  coordinates_lat = 59.920263, coordinates_lng = 10.6568315,
  needs_review = true,
  notes = coalesce(notes || E'\n', '') || 'Bestumåsen (også skrevet Aasen/Bestumaasen) i Aker herred; i dag Bestumveien 3. Koordinat omtrentlig (Bestum).',
  updated_at = now()
WHERE id = 648;
INSERT INTO place_aliases (address_id, name_variant)
  SELECT 648, v FROM (VALUES ('Bestumaasen, Aker'), ('Aasen, Aker'), ('Bestumåsen')) t(v)
  WHERE NOT EXISTS (SELECT 1 FROM place_aliases x WHERE x.name_variant = t.v);
INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note) VALUES
  ('I500025','claude','update','addresses','«Aasen» og «Bestumaasen» slått sammen til Bestumåsen (Bestumveien 3), etter opplysning fra Nicolay.');

-- ---------- B. Dobbeltpersoner
CREATE TEMP TABLE _mg (p text, s text, why text) ON COMMIT DROP;
INSERT INTO _mg VALUES
  ('I500022','I502372','Wilhelmine Martens Bull Wiig (f. 16.12.1902) lå inne to ganger'),
  ('I500246','I502368','Wilhelmine Kristiane Wiig (f. 23.6.1870, gravlagt 26.5.1871) lå inne to ganger');
DELETE FROM _mg m USING persons p WHERE p.person_id = m.s AND p.is_deleted;
-- Tom dødsfakta på hovedpersonen fylles fra duplikatet
UPDATE person_facts f SET date_text = d.date_text, date_year = d.date_year, date_month = d.date_month, date_day = d.date_day,
       place_raw = coalesce(f.place_raw, d.place_raw), place_id = coalesce(f.place_id, d.place_id)
FROM _mg m JOIN person_facts d ON d.person_id = m.s AND d.fact_type = 'DEAT'
WHERE f.person_id = m.p AND f.fact_type = 'DEAT' AND f.date_text IS NULL AND d.date_text IS NOT NULL;
UPDATE families f SET husband_id = m.p FROM _mg m WHERE f.husband_id = m.s;
UPDATE families f SET wife_id = m.p FROM _mg m WHERE f.wife_id = m.s;
DELETE FROM family_children c USING _mg m WHERE c.child_id = m.s
  AND EXISTS (SELECT 1 FROM family_children x WHERE x.child_id = m.p AND x.family_id = c.family_id);
UPDATE family_children c SET child_id = m.p FROM _mg m WHERE c.child_id = m.s;
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

COMMIT;

-- Kontroll: forventet 0 | 2 | 26 MAY 1871
SELECT (SELECT count(*) FROM addresses WHERE id = 921) bestumaasen_igjen,
       (SELECT count(*) FROM persons WHERE person_id IN ('I502372','I502368') AND is_deleted) slettet,
       (SELECT date_text FROM person_facts WHERE person_id = 'I500246' AND fact_type = 'DEAT') wilhelmine_dod;
