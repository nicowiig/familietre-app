-- 2026-10-21 · 10: Skedsmo-gårdene (nå Lillestrøm kommune) som ble forkastet i SQL 9
-- OpenStreetMap la dem i Løken (Aurskog-Høland). Koordinater fra Kartverkets stedsnavn-API, søkt i Lillestrøm.
BEGIN;
CREATE TEMP TABLE _g (id int, lat double precision, lng double precision, sure boolean, note text) ON COMMIT DROP;
INSERT INTO _g VALUES
(1410,59.99682,11.08746,true,'Kartverket: Leirsund (Tettsted), Lillestrøm'),
(875,59.99777,11.08212,true,'Kartverket: Søndre Ullreng (Gard), Lillestrøm'),
(1051,59.96007,11.01666,true,'Kartverket: Ryen (Gard), Lillestrøm'),
(1380,60.01864,10.97260,true,'Kartverket: Myrhaug (Bruk), Lillestrøm'),
(872,59.99226,11.10667,false,'Omtrentlig (Kartverket): Asak (Tettbebyggelse), Lillestrøm – gården Asak nordre ikke eget punkt'),
(899,59.99226,11.10667,false,'Omtrentlig (Kartverket): Asak (Tettbebyggelse), Lillestrøm – gården Asak nedre ikke eget punkt'),
(1057,59.99226,11.10667,false,'Omtrentlig (Kartverket): Asak (Tettbebyggelse), Lillestrøm – gården Asak øvre ikke eget punkt'),
(1125,60.00543,11.22975,false,'Omtrentlig (Kartverket): Sørum (Gard), Lillestrøm – usikkert om dette er gården «Sørum, Skedsmo»');
UPDATE addresses a SET coordinates_lat = g.lat, coordinates_lng = g.lng, needs_review = NOT g.sure,
  municipality = COALESCE(a.municipality, 'Lillestrøm'),
  notes = CASE WHEN a.notes IS NULL OR a.notes = '' THEN 'Koordinat: ' || g.note ELSE a.notes || E'\n' || 'Koordinat: ' || g.note END,
  updated_at = now()
FROM _g g WHERE a.id = g.id AND a.coordinates_lat IS NULL;
COMMIT;
SELECT count(*) uten_koordinater FROM addresses WHERE coordinates_lat IS NULL;
