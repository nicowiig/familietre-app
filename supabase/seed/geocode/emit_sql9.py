"""Lager 2026-10-21_9_koordinater.sql fra geokodingsresultatet (results.json).

results.json: {address_id: {lat, lon, src, prec, label, note?} | {none: true}}
Sikkerhet:
  - Kartverket-treff (navn + fylke, evt. kommune) og adressetreff  -> needs_review = false
  - Nominatim-treff der første ledd i svaret matcher stedsnavnet  -> needs_review = false
  - Alt annet (omtrentlig by/kommune, navn som ikke matcher)       -> koordinat settes, needs_review = true
Land- og fylkesnivå får ikke koordinater (et punkt midt i landet er misvisende på kart).
"""
import json, unicodedata, re, sys, os

HERE = os.path.dirname(__file__)
queue = {x['id']: x for x in json.load(open(os.path.join(HERE, 'queue.json')))}
res = json.load(open(os.path.join(HERE, 'results.json')))
overrides = json.load(open(os.path.join(HERE, 'overrides.json'))) if os.path.exists(os.path.join(HERE, 'overrides.json')) else {}


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


FYLKE = {
    'Hordaland': 'Vestland', 'Sogn og Fjordane': 'Vestland', 'Vestland': 'Vestland',
    'Sør-Trøndelag': 'Trøndelag', 'Nord-Trøndelag': 'Trøndelag', 'Trøndelag': 'Trøndelag',
    'Oppland': 'Innlandet', 'Hedmark': 'Innlandet', 'Innlandet': 'Innlandet',
    'Aust-Agder': 'Agder', 'Vest-Agder': 'Agder', 'Agder': 'Agder', 'Austagder': 'Agder',
    'Akershus': 'Akershus', 'Oslo': 'Oslo', 'Østfold': 'Østfold', 'Buskerud': 'Buskerud', 'Vestfold': 'Vestfold',
    'Telemark': 'Telemark', 'Rogaland': 'Rogaland', 'Møre og Romsdal': 'Møre og Romsdal', 'Nordland': 'Nordland',
    'Troms': 'Troms', 'Finnmark': 'Finnmark', 'Viken': 'Akershus',
}
LAN = {'Värmland': 'Värmland', 'Bohuslän': 'Västra Götaland', 'Kristianstad': 'Skåne', 'Kronoberg': 'Kronoberg',
       'Jämtland': 'Jämtland'}
rows, review, skipped, missing, rejected = [], [], [], [], []
for sid, r in {**res, **overrides}.items():
    aid = int(sid)
    item = queue.get(aid)
    if not item:
        continue
    if item['g'] in ('country', 'county'):
        skipped.append(aid)
        continue
    if not r or r.get('none') or r.get('error') or 'lat' not in r:
        missing.append(aid)
        continue
    label = r.get('label', '')
    first = norm(label.split(',')[0])
    short = norm(item['short'])
    nlabel = norm(label)
    city = norm(item.get('city'))
    # Norge: OSM-treff utenfor riktig fylke forkastes (f.eks. «Tune» -> Vestre Toten)
    if item['ct'] == 'Norge' and r.get('src') == 'nominatim':
        fy = FYLKE.get(item.get('county') or '')
        if fy and norm(fy) not in nlabel and not (fy == 'Akershus' and ' oslo' in ' ' + nlabel):
            rejected.append((aid, item['name'], label))
            continue
    if item['ct'] == 'Sverige' and r.get('src') == 'nominatim':
        lan = LAN.get(item.get('county') or '') or LAN.get(item.get('city') or '')
        if lan and norm(lan) not in nlabel:
            rejected.append((aid, item['name'], label))
            continue
    city_ok = (not city) or city == short or city in nlabel
    if r.get('src') == 'manual':
        sure = True
    elif r['src'] == 'kartverket' or r['prec'] == 'adresse':
        sure = True
    elif r['prec'] == 'sted' and short and first == short and city_ok:
        sure = True
    else:
        sure = False
    note = f"Koordinat fra {'Kartverket' if r['src'] == 'kartverket' else 'manuell vurdering' if r['src'] == 'manual' else 'OpenStreetMap'} ({r['prec']}): {label}"
    if r.get('note'):
        note += f". {r['note']}"
    rows.append((aid, r['lat'], r['lon'], sure, note))
    if not sure:
        review.append((aid, item['name'], label))

out = os.path.join(HERE, '..', 'fixes', '2026-10-21_9_koordinater.sql')
with open(out, 'w') as f:
    f.write('-- 2026-10-21 · 9: koordinater for steder uten posisjon, opprydding i to vielsessteder\n')
    f.write(f'-- {len(rows)} steder får koordinater ({sum(1 for r in rows if r[3])} sikre, {len(review)} merket for gjennomgang).\n')
    f.write(f'-- {len(skipped)} land/fylker hoppes over med vilje, {len(missing)} fant ingen treff.\n')
    f.write('-- Kilder: Kartverkets stedsnavn-API (ws.geonorge.no) og OpenStreetMap Nominatim.\n\nBEGIN;\n\n')
    f.write('CREATE TEMP TABLE _g (id int, lat double precision, lng double precision, sure boolean, note text) ON COMMIT DROP;\n')
    f.write('INSERT INTO _g VALUES\n')
    f.write(',\n'.join(f" ({a}, {la:.6f}, {lo:.6f}, {'true' if s else 'false'}, {q(n)})" for a, la, lo, s, n in rows))
    f.write(';\n\n')
    f.write('''UPDATE addresses a SET coordinates_lat = g.lat, coordinates_lng = g.lng,
  needs_review = NOT g.sure,
  notes = CASE WHEN a.notes IS NULL OR a.notes = '' THEN g.note ELSE a.notes || E'\\n' || g.note END,
  updated_at = now()
FROM _g g WHERE a.id = g.id AND a.coordinates_lat IS NULL;

-- To vielsessteder som ikke er steder (rå tekst bevares i loggen)
INSERT INTO person_audit_log (person_id, changed_by, change_type, table_name, note) VALUES
 ('I500463','claude','update','families','Vielsessted «Ã» (ødelagt tegn fra import) fjernet fra F500111.'),
 ('I500464','claude','update','families','Vielsessted «Ã» (ødelagt tegn fra import) fjernet fra F500111.'),
 ('I502003','claude','update','families','Vielsessted «Bosatt på Elofsbyn» fjernet fra F500540 – registrert som bosted i stedet.'),
 ('I502004','claude','update','families','Vielsessted «Bosatt på Elofsbyn» fjernet fra F500540 – registrert som bosted i stedet.');
UPDATE families SET marr_place_raw = NULL WHERE family_id = 'F500111' AND marr_place_raw = 'Ã';
UPDATE families SET marr_place_raw = NULL WHERE family_id = 'F500540' AND marr_place_raw = 'Bosatt på Elofsbyn';

COMMIT;

-- Kontroll
SELECT (SELECT count(*) FROM addresses WHERE coordinates_lat IS NULL) uten_koordinater,
       (SELECT count(*) FROM addresses a JOIN _g g ON g.id = a.id) ,
       (SELECT count(*) FROM families WHERE marr_place_raw IS NOT NULL AND marr_place_id IS NULL) vielser_ukoblet;
'''.replace("(SELECT count(*) FROM addresses a JOIN _g g ON g.id = a.id) ,\n       ", "(SELECT count(*) FROM addresses WHERE needs_review AND coordinates_lat IS NOT NULL) til_gjennomgang,\n       "))

with open(os.path.join(HERE, 'gjennomgang.csv'), 'w') as f:
    f.write('id;sted;treff\n')
    for a, n, l in review:
        f.write(f'{a};{n};{l}\n')
    for a in missing:
        f.write(f"{a};{queue[a]['name']};INGEN TREFF\n")
    for a, n, l in rejected:
        f.write(f'{a};{n};FORKASTET (feil fylke): {l}\n')
print(f'{len(rows)} rader, {len(review)} usikre, {len(skipped)} hoppet over, {len(missing)} uten treff, {len(rejected)} forkastet -> {out}')
