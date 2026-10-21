"""SQL del 8: kobler de 148 manuelle stedene etter gjennomgang med Nicolay."""
import json
rows = json.load(open('forslag.json'))
NOR = 'Norge'
def q(v):
    if v is None or v == '': return 'NULL'
    if isinstance(v, int): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

# Overstyringer etter gjennomgang (raw -> (navn, region, land, notat på hendelsen))
OVR = {
 'Hjemme': ('Stavern', 'Vestfold', NOR, None),
 'Forlis på reise til/fra Trondheim': ('På sjøen mellom Bergen og Trondheim', None, NOR, 'Omkom ved forlis som styrmann.'),
 'King of Polen': ('Vilnius-katedralen, Vilnius', None, 'Litauen', None),
 'Vilniaus arkikatedra': ('Vilnius-katedralen, Vilnius', None, 'Litauen', None),
 'Ryde og senere Nakskov': ('Ryde, Lolland', 'Maribo', 'Danmark', 'Senere flyttet til Nakskov.'),
 'kapellet under koret': ('Strandby kirke, Vesthimmerland', 'Aalborg', 'Danmark', 'Gravkapellet under koret (sannsynlig – avledet av fødested og dødssted i Strandby).'),
 'Aalum opsl 35/183': ('Aalum', 'Viborg', 'Danmark', 'Kirkebok: opslag 35/183.'),
 'Gården Fosseli': ('Fosseli, Øyestad', 'Aust-Agder', NOR, None),
 'Midtschoug,': ('Midtskogen, Grue Finnskog', 'Hedmark', NOR, None),
 'Ris kirkegård': ('Ris kirkegård, Oslo', 'Akershus', NOR, None),
 'Rud Høland Akershus 03.02.': ('Rud, Høland', 'Akershus', NOR, None),
 'Skanderborg S.- Hjelmslev H.- Skanderborg A.': ('Skanderborg', 'Skanderborg', 'Danmark', 'Trolig Skanderborg slott.'),
 'Jylland?, Danmark?': ('Jylland', None, 'Danmark', 'Usikkert sted i kilden («Jylland?, Danmark?»).'),
 'Vestindien': ('Jomfruøyene', None, 'De amerikanske Jomfruøyene', 'Kilden sier bare «Vestindien» – trolig Dansk Vestindia.'),
 'Sct. Croix, De Dansk Vestindiske Øer': ('St. Croix', None, 'De amerikanske Jomfruøyene', None),
 'Sunnmøre': ('Sunnmøre', 'Møre og Romsdal', NOR, None),
 'Amundsrød, Østervallskog / Tøcksmark': ('Amundsrød, Östervallskog', 'Värmland', 'Sverige', None),
}
SKIP = {'Ã', 'Frivillig i fransk krigstjeneste i Alger', 'Bosatt på Elofsbyn'}   # håndteres særskilt

plan = []   # (raw, target_id or None, name, region, country, note)
for r in rows:
    raw = r['raw']
    if raw in SKIP: continue
    if raw in OVR:
        n, reg, ct, note = OVR[raw]; plan.append((raw, None, n, reg, ct, note)); continue
    if r['handling'] == 'koble' and r['koble_til_id']:
        plan.append((raw, int(r['koble_til_id']), None, None, None, None))
    elif r['handling'] == 'opprett' and r['struct'] and r['struct']['country']:
        s = r['struct']; plan.append((raw, None, s['name'], s['region'], s['country'], None))

def disp(n, reg, ct):
    return n if ct == NOR else ', '.join(x for x in [n, reg if reg and reg not in n else None, ct] if x)

L = ["""-- ============================================================
-- Steder del 8 (21.10.2026): de manuelle stedene etter gjennomgang + sjekk av fylke/land
-- place_raw endres ikke. Merknader legges i notes på hendelsen.
-- ============================================================
BEGIN;
CREATE TEMP TABLE _m (raw text PRIMARY KEY, target integer, name text, region text, country text, disp text, note text) ON COMMIT DROP;"""]
L.append('INSERT INTO _m VALUES\n' + ',\n'.join('(' + ','.join(q(x) for x in [raw, t, n, reg, ct, disp(n, reg, ct) if n else None, note]) + ')' for raw, t, n, reg, ct, note in plan) + ';')
L.append("""
-- Nye steder (ett per visningsnavn; finnes navnet i samme land fra før, brukes det)
UPDATE _m m SET target = a.id FROM addresses a
WHERE m.target IS NULL AND a.country = m.country AND lower(coalesce(a.name_display, '')) = lower(m.disp);
INSERT INTO addresses (city, locality, county, country, name_short, name_display, granularity, needs_review, notes, place_raw)
SELECT DISTINCT ON (lower(disp), country)
  CASE WHEN position(', ' IN name) > 0 THEN split_part(name, ', ', 2) ELSE name END,
  CASE WHEN position(', ' IN name) > 0 THEN split_part(name, ', ', 1) END,
  region, country, split_part(name, ', ', 1), disp,
  CASE WHEN position(', ' IN name) > 0 THEN 'locality' ELSE 'city' END, true,
  'stedsvask8:' || lower(disp), raw
FROM _m WHERE target IS NULL;
UPDATE _m m SET target = a.id FROM addresses a WHERE m.target IS NULL AND a.notes = 'stedsvask8:' || lower(m.disp);
UPDATE addresses SET notes = 'Opprettet ved stedsgjennomgang 21.10.2026 – mangler koordinater' WHERE notes LIKE 'stedsvask8:%';

ALTER TABLE public.person_facts DISABLE TRIGGER audit_person_facts;
UPDATE person_facts f SET place_id = m.target,
  notes = CASE WHEN m.note IS NULL THEN f.notes WHEN f.notes IS NULL OR f.notes = '' THEN m.note
               WHEN position(m.note IN f.notes) > 0 THEN f.notes ELSE f.notes || ' ' || m.note END
FROM _m m WHERE f.place_raw = m.raw AND m.target IS NOT NULL;
ALTER TABLE public.person_facts ENABLE TRIGGER audit_person_facts;
UPDATE families fam SET marr_place_id = m.target FROM _m m WHERE fam.marr_place_raw = m.raw AND m.target IS NOT NULL;
INSERT INTO place_aliases (name_variant, canonical_name, modern_country, address_id)
SELECT m.raw, coalesce(a.name_display, a.name_short, a.city), a.country, a.id FROM _m m JOIN addresses a ON a.id = m.target
ON CONFLICT (name_variant) DO UPDATE SET address_id = EXCLUDED.address_id, canonical_name = EXCLUDED.canonical_name;
INSERT INTO person_audit_log (person_id, changed_by, change_type, table_name, note)
SELECT DISTINCT f.person_id, 'claude', 'update', 'person_facts', 'Sted koblet etter manuell gjennomgang: «' || f.place_raw || '» → ' || coalesce(a.name_display, a.name_short)
FROM person_facts f JOIN _m m ON m.raw = f.place_raw JOIN addresses a ON a.id = m.target;

-- Maren Pedersdatter: kirkebokas gravlegging 24.12.1693 (med side-henvisning) veier tyngre enn 1683 fra finnholbek.dk
UPDATE person_facts SET date_text = 'DEC 1693', date_year = 1693, date_month = 12, date_day = NULL,
  notes = 'Rettet tilbake til 1693: gravlagt 24.12.1693 i Aalum ifølge kirkeboka (opslag 35/183). finnholbek.dk oppgir 1683, trolig skrivefeil.'
WHERE person_id = 'I502041' AND fact_type = 'DEAT';

-- Hjemmevielse i Stavern (Carl Ditlev Eberhardt og Anne Farup, 1774)
INSERT INTO person_audit_log (person_id, changed_by, change_type, table_name, note) VALUES
 ('I501012','claude','update','families','Vielse 1774 «Hjemme» satt til Stavern: hjemmevielse, sannsynligvis i Fredriksvern der han var auditør ved verftet og alle barna ble født.'),
 ('I501013','claude','update','families','Vielse 1774 «Hjemme» satt til Stavern: hjemmevielse, sannsynligvis i Fredriksvern.');

-- Carl Schmettow (1817–1858): fransk krigstjeneste til karrieren, feil hendelsestype fjernes
INSERT INTO person_work_experience (person_id, employer, title, place, notes)
SELECT 'I501150', 'Den franske hær', 'Frivillig', 'Alger, Algerie',
  'Ubekreftet – ingen kilde funnet. Mulig forveksling med bestefaren, general Carl von Schmettow (1744–1821), som tjenestegjorde i Frankrike fra 1763.'
WHERE NOT EXISTS (SELECT 1 FROM person_work_experience WHERE person_id = 'I501150' AND employer = 'Den franske hær');
DELETE FROM person_facts WHERE person_id = 'I501150' AND fact_type = 'NATU' AND place_raw = 'Frivillig i fransk krigstjeneste i Alger';

-- Elofsbyn: bosted, ikke vielsessted (Per Andersson og Ingeborg Bryngelsdotter)
INSERT INTO addresses (city, locality, county, country, name_short, name_display, granularity, needs_review, notes, place_raw)
SELECT 'Östervallskog', 'Elofsbyn', 'Värmland', 'Sverige', 'Elofsbyn', 'Elofsbyn, Östervallskog, Värmland, Sverige', 'locality', true,
       'Opprettet ved stedsgjennomgang 21.10.2026 – mangler koordinater', 'Bosatt på Elofsbyn'
WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE name_display = 'Elofsbyn, Östervallskog, Värmland, Sverige');
INSERT INTO address_periods (address_id, entity_type, entity_id, period_type, notes, source_type)
SELECT a.id, 'person', p.pid, 'residence', 'Fra kilden: «Bosatt på Elofsbyn»', 'gedcom'
FROM addresses a, (VALUES ((SELECT husband_id FROM families WHERE family_id = 'F500540')), ((SELECT wife_id FROM families WHERE family_id = 'F500540'))) p(pid)
WHERE a.name_display = 'Elofsbyn, Östervallskog, Värmland, Sverige' AND p.pid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM address_periods x WHERE x.address_id = a.id AND x.entity_id = p.pid);

-- Dansk Vestindia: St. Thomas (1672), St. Jan (1718), St. Croix (1733), solgt til USA 31.3.1917.
-- Dagens land er De amerikanske Jomfruøyene; tidsdataene gir «den gang Dansk Vestindia».
INSERT INTO polities (name, description) VALUES
 ('Dansk Vestindia (Danmark-Norge)', 'Dansk-norsk koloni i Karibia: St. Thomas (1672), St. Jan (1718) og St. Croix (kjøpt fra Frankrike 1733). Sukkerplantasjer drevet med slavearbeid.'),
 ('Dansk Vestindia (Danmark)', 'Dansk koloni etter 1814, solgt til USA for 25 millioner dollar 31. mars 1917. Slaveriet ble opphevet i 1848.')
ON CONFLICT (name) DO NOTHING;
INSERT INTO place_jurisdictions (country, region, valid_from, valid_to, polity_id)
SELECT 'De amerikanske Jomfruøyene', NULL, v.f, v.t, p.id FROM (VALUES (1672, 1813, 'Dansk Vestindia (Danmark-Norge)'), (1814, 1916, 'Dansk Vestindia (Danmark)')) v(f, t, n)
JOIN polities p ON p.name = v.n
WHERE NOT EXISTS (SELECT 1 FROM place_jurisdictions j WHERE j.country = 'De amerikanske Jomfruøyene' AND j.polity_id = p.id);
INSERT INTO place_name_periods (modern_name, country, historical_name, valid_from, valid_to, note)
SELECT 'Jomfruøyene', 'De amerikanske Jomfruøyene', 'Dansk Vestindia', 1672, 1916, NULL
WHERE NOT EXISTS (SELECT 1 FROM place_name_periods WHERE modern_name = 'Jomfruøyene');
UPDATE addresses SET country = 'De amerikanske Jomfruøyene', county = NULL, historical_region = 'Dansk Vestindia',
  name_display = coalesce(name_short, city) || ', De amerikanske Jomfruøyene'
WHERE coalesce(county, historical_region) IN ('Dansk Vestindia', 'De Dansk Vestindiske Øer') OR city IN ('St. Croix', 'Sct. Croix', 'St. Thomas', 'St. Jan');

-- Sjekk av fylke/land: regionen viser hvilket land stedet ligger i
UPDATE addresses SET country = 'Danmark' WHERE country IN ('Norge','Sverige','USA')
  AND coalesce(county, historical_region) IN ('Midtjylland','Nordjylland','Sjælland','Hovedstaden','Syddanmark','Region of Southern Danmark',
    'Ringkøbing','Ringkobing','Viborg','Aalborg','Maribo','Præstø','Frederiksborg','Odense','Svendborg','Skanderborg','Sønderjylland','Fyn','Jylland','Lolland','Falster');
UPDATE addresses SET country = 'Sverige' WHERE country IN ('Norge','Danmark')
  AND coalesce(county, historical_region) IN ('Värmland','Jämtland','Bohuslän','Skåne','Kristianstad','Västra Götaland','Norrbotten','Älvsborg','Alvsborg');
UPDATE addresses SET country = 'Tyskland' WHERE country IN ('Norge','Danmark','Sverige')
  AND coalesce(county, historical_region) IN ('Sachsen','Brandenburg','Bayern','Mecklenburg','Niedersachsen','Hessen','Thüringen');
UPDATE addresses SET county = NULL WHERE country = 'Norge' AND county = 'Norge';

COMMIT;

SELECT (SELECT count(*) FROM person_facts WHERE place_raw IS NOT NULL) hendelser_med_sted,
       (SELECT count(*) FROM person_facts WHERE place_id IS NOT NULL) koblet,
       (SELECT count(*) FROM person_facts WHERE place_raw IS NOT NULL AND place_id IS NULL) ukoblet,
       (SELECT count(*) FROM families WHERE marr_place_raw IS NOT NULL AND marr_place_id IS NULL) vielser_ukoblet,
       (SELECT count(*) FROM addresses WHERE coordinates_lat IS NULL) uten_koordinater;
""")
open('../fixes/2026-10-21_8_steder_gjennomgang.sql', 'w', encoding='utf-8').write('\n'.join(L))
print(len(plan), 'koblinger')
