-- ============================================================
-- 2026-10-21 · 12: bryllupsbildet til Ellen og Nicolay (gruppebilde med bildetekst)
-- FORUTSETNING: bildet er lastet opp med «+ Nytt bilde» på Nicolay Kieding Wiigs profil (I500007).
-- Skriptet tar det sist opplastede bildet hans, merker det som gruppebilde med bildetekst,
-- og kobler det til de som er navngitt i bildeteksten og finnes i treet.
-- ============================================================
BEGIN;

ALTER TABLE person_photos ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE person_photos ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN person_photos.is_group IS 'Gruppebilde – blir aldri profilbilde automatisk.';

CREATE TEMP TABLE _ph ON COMMIT DROP AS
  SELECT id, drive_url FROM person_photos WHERE person_id = 'I500007' ORDER BY id DESC LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM _ph WHERE drive_url LIKE 'I500007/%') THEN
    RAISE EXCEPTION 'Fant ikke et opplastet bilde på I500007 – last opp bryllupsbildet først.';
  END IF;
END $$;

UPDATE person_photos p SET
  is_group = true,
  is_primary = CASE WHEN (SELECT count(*) FROM person_photos x WHERE x.person_id = 'I500007') > 1 THEN false ELSE p.is_primary END,
  caption = 'Ellen og Nicolays bryllup. Etter dem med klokken: Ellens bestemor Anna Larsdatter Farmen, Peder Ås, Elin Myhre, Ingrid Sofie («Ingsefi») Wiig, senere Tuxen, Ole Friele, tante X (tannlege), tante Kari gift med Claus Winther Hjelm Wiig, onkel Bobby gift med tante Lill (Aagots søster), to ukjente, deretter Wilhelmine Grieg f. Wiig og Jørgen Andvig.',
  date_taken = coalesce(p.date_taken, 'ca. 1953')
FROM _ph WHERE p.id = _ph.id;

-- Samme bilde på profilene til de navngitte som finnes i treet
INSERT INTO person_photos (person_id, drive_url, is_primary, photo_order, caption, is_group, date_taken)
SELECT t.pid, _ph.drive_url, false, 99, ph.caption, true, ph.date_taken
FROM _ph JOIN person_photos ph ON ph.id = _ph.id,
  (VALUES ('I500006'),   -- Ellen Kathrine Andvig (bruden)
          ('I502375'),   -- Ingrid Sofie («Ingsefi») Tuxen f. Wiig
          ('I500023'),   -- Claus Winther Hjelm Wiig
          ('I500042'),   -- Kari Knudsen, gift med Claus
          ('I500797'),   -- Christian Nikolai Bøhmer («onkel Bobby»)
          ('I500796'),   -- Lill Jakobsen, Aagots søster
          ('I500022'),   -- Wilhelmine Grieg f. Wiig
          ('I500376')    -- Jørgen Andvig
  ) t(pid)
WHERE NOT EXISTS (SELECT 1 FROM person_photos x WHERE x.person_id = t.pid AND x.drive_url = _ph.drive_url);

-- Kallenavn fra bildeteksten
UPDATE person_names SET nickname = 'Bobby' WHERE person_id = 'I500797' AND nickname IS NULL;
UPDATE person_names SET nickname = 'Ingsefi' WHERE person_id = 'I502375' AND nickname IS NULL;

INSERT INTO person_audit_log(person_id, changed_by, change_type, table_name, note)
SELECT pid, 'claude', 'insert', 'person_photos', 'Bryllupsbildet til Ellen og Nicolay Kieding Wiig (ca. 1953) koblet til fra bildeteksten.'
FROM (VALUES ('I500006'),('I500007'),('I502375'),('I500023'),('I500042'),('I500797'),('I500796'),('I500022'),('I500376')) t(pid);

COMMIT;

SELECT person_id, is_primary, is_group FROM person_photos WHERE caption LIKE 'Ellen og Nicolays bryllup%' ORDER BY person_id;
