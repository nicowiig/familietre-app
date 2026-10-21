import json
p = json.load(open('plan.json'))
def q(v):
    if v is None or v == '': return 'NULL'
    if isinstance(v, int): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

raw_rows = [(r, n['key'], n['city'], n['area'], n['country']) for r, n in p['norm'].items() if r not in set(p['manual']) and n['key'] in p['key_disp']]
new_by_key = {x['key']: x for x in p['new']}
key_rows = []
for key, (short, disp, hist) in p['key_disp'].items():
    ex = p['canon'].get(key)
    nw = new_by_key.get(key)
    if ex is None and nw is None: continue
    key_rows.append((key, ex, short, disp, hist, nw))

L = []
L.append("""-- ============================================================
-- Stedsvask fase 1–2 (21.10.2026)
--   * Nye felt: addresses.name_short / name_display (visningsnavn), families.marr_place_id,
--     place_aliases.address_id; person_facts.place_id blir en ekte kobling (integer → addresses)
--   * {nr} råstrenger koblet til {nk} kanoniske steder ({nn} nye, {ne} eksisterende), {nd} duplikater i adresseregisteret slått sammen
--   * place_raw endres ALDRI (REQ-PLC06). Ikke-koblede strenger ({nm}) går til manuell gjennomgang.
-- Generert av supabase/seed/places/emit_sql.py
-- ============================================================
BEGIN;

ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS name_short text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS name_display text;
COMMENT ON COLUMN public.addresses.name_short   IS 'Kort visningsnavn: «Meißen», «Korskirken».';
COMMENT ON COLUMN public.addresses.name_display IS 'Visningsnavn: «Meißen, Sachsen, Tyskland», «Korskirken, Bergen». Norske steder uten fylke.';
ALTER TABLE public.person_facts ALTER COLUMN place_id TYPE integer USING NULLIF(place_id, '')::integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_facts_place_id_fkey') THEN
    ALTER TABLE public.person_facts ADD CONSTRAINT person_facts_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.addresses(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_person_facts_place_id ON public.person_facts(place_id);
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS marr_place_id integer REFERENCES public.addresses(id) ON DELETE SET NULL;
ALTER TABLE public.place_aliases ADD COLUMN IF NOT EXISTS address_id integer REFERENCES public.addresses(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_place_aliases_variant ON public.place_aliases (name_variant);

-- Massekobling: én samlet loggføring per person i stedet for tusenvis av feltendringer
ALTER TABLE public.person_facts DISABLE TRIGGER audit_person_facts;
ALTER TABLE public.address_periods DISABLE TRIGGER audit_address_periods;
ALTER TABLE public.families DISABLE TRIGGER audit_families;

CREATE TEMP TABLE _key (key text PRIMARY KEY, address_id integer, short text, disp text, hist text,
  n_street text, n_hn integer, n_hl text, n_locality text, n_city text, n_county text, n_country text, n_hreg text, n_rode text, n_gran text, n_rep text) ON COMMIT DROP;
CREATE TEMP TABLE _raw (raw text PRIMARY KEY, key text, city text, area text, country text) ON COMMIT DROP;
CREATE TEMP TABLE _dup (dup_id integer PRIMARY KEY, canon_id integer) ON COMMIT DROP;
""".format(nr=len(raw_rows), nk=len(key_rows), nn=len(p['new']), ne=len(p['canon']), nd=len(p['dups']), nm=len(p['manual'])))

def chunks(rows, n=400):
    for i in range(0, len(rows), n): yield rows[i:i+n]
for ch in chunks(key_rows):
    vals = []
    for key, ex, short, disp, hist, nw in ch:
        nw = nw or {}
        vals.append('(' + ','.join(q(x) for x in [key, ex, short, disp, hist, nw.get('street'), nw.get('hn'), nw.get('hl'), nw.get('locality'),
                     nw.get('city'), nw.get('county'), nw.get('country'), nw.get('hreg'), nw.get('rode'), nw.get('g'), nw.get('rep')]) + ')')
    L.append('INSERT INTO _key VALUES\n' + ',\n'.join(vals) + ';')
for ch in chunks(raw_rows):
    L.append('INSERT INTO _raw VALUES\n' + ',\n'.join('(' + ','.join(q(x) for x in r) + ')' for r in ch) + ';')
if p['dups']:
    L.append('INSERT INTO _dup VALUES\n' + ',\n'.join(f'({a},{b})' for a, b in p['dups']) + ';')

L.append("""
-- 1. Nye kanoniske steder (uten koordinater – merkes for gjennomgang)
INSERT INTO addresses (street_name, house_number, house_letter, locality, city, county, country, historical_region, historical_name,
                       bergen_rode, place_raw, granularity, needs_review, notes, name_short, name_display)
SELECT n_street, n_hn, n_hl, n_locality, n_city, n_county, n_country, n_hreg, hist, n_rode, n_rep, n_gran, true,
       'stedsvask:' || key, short, disp
FROM _key WHERE address_id IS NULL;
UPDATE _key k SET address_id = a.id FROM addresses a WHERE k.address_id IS NULL AND a.notes = 'stedsvask:' || k.key;
UPDATE addresses SET notes = 'Opprettet ved stedsvask 21.10.2026 – mangler koordinater' WHERE notes LIKE 'stedsvask:%';

-- 2. Visningsnavn og norsk landnavn på eksisterende kanoniske steder
UPDATE addresses a SET
  name_short   = coalesce(a.name_short, k.short),
  name_display = coalesce(a.name_display, k.disp),
  historical_name = coalesce(a.historical_name, k.hist),
  country = coalesce(r.country, a.country)
FROM _key k LEFT JOIN LATERAL (SELECT country FROM _raw WHERE key = k.key AND country IS NOT NULL LIMIT 1) r ON true
WHERE a.id = k.address_id;
UPDATE addresses SET country = CASE country WHEN 'Deutschland' THEN 'Tyskland' WHEN 'Norway' THEN 'Norge' WHEN 'Denmark' THEN 'Danmark'
  WHEN 'Sweden' THEN 'Sverige' WHEN 'Germany' THEN 'Tyskland' WHEN 'Poland' THEN 'Polen' WHEN 'Netherlands' THEN 'Nederland' ELSE country END
WHERE country IN ('Deutschland','Norway','Denmark','Sweden','Germany','Poland','Netherlands');

-- 3. Duplikater i adresseregisteret: pek om og slett de som ikke lenger brukes
UPDATE address_periods ap SET address_id = d.canon_id FROM _dup d WHERE ap.address_id = d.dup_id;
UPDATE place_articles pa SET address_id = d.canon_id FROM _dup d WHERE pa.address_id = d.dup_id;
DELETE FROM addresses a USING _dup d WHERE a.id = d.dup_id
  AND NOT EXISTS (SELECT 1 FROM address_periods WHERE address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM place_articles WHERE address_id = a.id);

-- 4. Koble hendelser og vielser (place_raw beholdes uendret)
UPDATE person_facts f SET place_id = k.address_id,
  place_city = coalesce(r.city, f.place_city), place_region = coalesce(r.area, f.place_region), place_country = coalesce(r.country, f.place_country)
FROM _raw r JOIN _key k ON k.key = r.key WHERE f.place_raw = r.raw;
UPDATE families fam SET marr_place_id = k.address_id FROM _raw r JOIN _key k ON k.key = r.key WHERE fam.marr_place_raw = r.raw;

-- 5. Fødested/dåpssted/dødssted/gravsted i adresselisten skal være samme sted som hendelsen (ikke bekreftede)
UPDATE address_periods ap SET address_id = f.place_id
FROM person_facts f
WHERE ap.entity_type = 'person' AND ap.entity_id = f.person_id AND NOT coalesce(ap.is_confirmed, false)
  AND f.place_id IS NOT NULL AND ap.address_id <> f.place_id
  AND ((ap.period_type = 'birth_place' AND f.fact_type = 'BIRT') OR (ap.period_type = 'death_place' AND f.fact_type = 'DEAT')
    OR (ap.period_type = 'burial_place' AND f.fact_type = 'BURI') OR (ap.period_type = 'baptism_place' AND f.fact_type IN ('CHR','BAPM')))
  AND (SELECT count(*) FROM person_facts x WHERE x.person_id = f.person_id AND x.fact_type = f.fact_type AND x.place_id IS NOT NULL) = 1;

-- 6. Aliastabell: alle kjente skrivemåter -> kanonisk sted (brukes også ved fremtidig import)
INSERT INTO place_aliases (name_variant, canonical_name, modern_country, historical_context, address_id)
SELECT r.raw, k.disp, r.country, k.hist, k.address_id FROM _raw r JOIN _key k ON k.key = r.key
ON CONFLICT (name_variant) DO UPDATE SET canonical_name = EXCLUDED.canonical_name, address_id = EXCLUDED.address_id,
  modern_country = EXCLUDED.modern_country, historical_context = EXCLUDED.historical_context;

ALTER TABLE public.person_facts ENABLE TRIGGER audit_person_facts;
ALTER TABLE public.address_periods ENABLE TRIGGER audit_address_periods;
ALTER TABLE public.families ENABLE TRIGGER audit_families;

INSERT INTO person_audit_log (person_id, changed_by, change_type, table_name, note)
SELECT DISTINCT f.person_id, 'claude', 'update', 'person_facts', 'Steder koblet til stedsregisteret (stedsvask 21.10.2026). Opprinnelig skrivemåte er beholdt.'
FROM person_facts f JOIN _raw r ON r.raw = f.place_raw;

COMMIT;

SELECT
  (SELECT count(*) FROM person_facts WHERE place_raw IS NOT NULL) AS hendelser_med_sted,
  (SELECT count(*) FROM person_facts WHERE place_id IS NOT NULL) AS koblet,
  (SELECT count(*) FROM families WHERE marr_place_id IS NOT NULL) AS vielser_koblet,
  (SELECT count(*) FROM addresses) AS steder_i_registeret,
  (SELECT count(*) FROM addresses WHERE coordinates_lat IS NULL) AS uten_koordinater,
  (SELECT count(*) FROM place_aliases) AS aliaser;
""")
open('../fixes/2026-10-21_6_steder.sql', 'w', encoding='utf-8').write('\n'.join(L))
print(len(raw_rows), len(key_rows))
