import json, collections, re, csv
from normalize import normalize, k, NO_COUNTY
ctx = json.load(open('manual_ctx.json')); adr = json.load(open('addresses_now.json'))
cnt = {r['raw']: r['n'] for r in json.load(open('places_raw.json'))}
W = {'selv': 3, 'ektefelle': 2, 'forelder': 2, 'søsken': 1.5, 'barn': 1}
canon_county = lambda c: NO_COUNTY.get(k(c or ''), c)

# Kjente steder jeg er sikker på (navn i kilden -> (sted, region, land, merknad))
KNOWN = {
 'liverpool': ('Liverpool', None, 'England'), 'göteborg': ('Göteborg', 'Västra Götaland', 'Sverige'),
 'bordeaux': ('Bordeaux', None, 'Frankrike'), 'leeuwarden': ('Leeuwarden', 'Friesland', 'Nederland'),
 'bolsward': ('Bolsward', 'Friesland', 'Nederland'), 'sexbierum': ('Sexbierum', 'Friesland', 'Nederland'),
 'stiens': ('Stiens', 'Friesland', 'Nederland'), 'hardegarijp': ('Hardegarijp', 'Friesland', 'Nederland'),
 'gerkesklooster': ('Gerkesklooster', 'Friesland', 'Nederland'), 'dongjum': ('Dongjum', 'Friesland', 'Nederland'),
 'bergum': ('Bergum', 'Friesland', 'Nederland'), 'zwaagwesteinde': ('Zwaagwesteinde', 'Friesland', 'Nederland'),
 'kooten': ('Kootstertille', 'Friesland', 'Nederland'), 'arum': ('Arum', 'Friesland', 'Nederland'),
 'zuidlaren': ('Zuidlaren', 'Drenthe', 'Nederland'), 'hoogeveen': ('Hoogeveen', 'Drenthe', 'Nederland'),
 'den haag': ('Haag', 'Sør-Holland', 'Nederland'), 'utrecht': ('Utrecht', 'Utrecht', 'Nederland'),
 'glücksburg': ('Glücksburg', 'Slesvig-Holsten', 'Tyskland'), 'esslingen am neckar': ('Esslingen am Neckar', 'Baden-Württemberg', 'Tyskland'),
 'langelsheim': ('Langelsheim', 'Niedersachsen', 'Tyskland'), 'weißenfels': ('Weißenfels', 'Sachsen-Anhalt', 'Tyskland'),
 'elsterwerda': ('Elsterwerda', 'Brandenburg', 'Tyskland'), 'mückenberg': ('Mückenberg (Lauchhammer)', 'Brandenburg', 'Tyskland'),
 'altenburg': ('Altenburg', 'Thüringen', 'Tyskland'), 'schloß neuhaus': ('Neuhaus an der Elbe', 'Niedersachsen', 'Tyskland'),
 'konigsberg': ('Kaliningrad', 'Ostpreußen', 'Russland'), 'glatz': ('Kłodzko', 'Schlesien', 'Polen'),
 'neustadt in oberschlesien': ('Prudnik', 'Schlesien', 'Polen'), 'słońsk': ('Słońsk', 'Lebus', 'Polen'),
 'bratislava': ('Bratislava', None, 'Slovakia'), 'košice': ('Košice', None, 'Slovakia'),
 'komárom (now komárno in slovakia)': ('Komárno', None, 'Slovakia'), 'ungar.-hradisch': ('Uherské Hradiště', 'Mähren', 'Tsjekkia'),
 'ungarisch-ostra': ('Uherský Ostroh', 'Mähren', 'Tsjekkia'), 'vilniaus arkikatedra': ('Vilnius katedral, Vilnius', None, 'Litauen'),
 'seattle': ('Seattle', 'Washington', 'USA'), 'kramer': ('Kramer', 'North Dakota', 'USA'),
 'sct. croix': ('St. Croix', 'Dansk Vestindia', 'Danmark'), 'bengalen': ('Bengal', None, 'India'),
 'alesund': ('Ålesund', 'Møre og Romsdal', 'Norge'), 'laurvig': ('Larvik', 'Vestfold', 'Norge'), 'larvik ?': ('Larvik', 'Vestfold', 'Norge'),
 'købehavn': ('København', None, 'Danmark'), 'klegod nysogn': ('Klegod, Nysogn', 'Ringkøbing', 'Danmark'),
 'aalborg budolfi': ('Budolfi kirke, Aalborg', 'Aalborg', 'Danmark'), 'sakskøbing': ('Sakskøbing', 'Maribo', 'Danmark'),
 'rømskog': ('Rømskog', 'Østfold', 'Norge'), 'gressvik': ('Gressvik, Onsøy', 'Østfold', 'Norge'), 'mysen': ('Mysen', 'Østfold', 'Norge'),
 'lier': ('Lier', 'Buskerud', 'Norge'), 'gausdal': ('Gausdal', 'Oppland', 'Norge'), 'vardal': ('Vardal', 'Oppland', 'Norge'),
 'øksnes': ('Øksnes', 'Nordland', 'Norge'), 'hol': ('Hol', 'Buskerud', 'Norge'), 'skaanevik': ('Skånevik', 'Hordaland', 'Norge'),
 'lovisenberg sykehus': ('Lovisenberg sykehus, Oslo', 'Akershus', 'Norge'), 'petruskirken oslo': ('Petruskirken, Oslo', 'Akershus', 'Norge'),
 'trondheim katedralskole': ('Trondheim katedralskole, Trondheim', 'Sør-Trøndelag', 'Norge'),
 'hakadal': ('Hakadal, Nittedal', 'Akershus', 'Norge'), 'ørkedalen': ('Orkdal', 'Sør-Trøndelag', 'Norge'),
 'storkvikne orkdalen sör tröndelag': ('Storkvikne, Orkdal', 'Sør-Trøndelag', 'Norge'),
 'cementerio de la capilla de lade kirke en tromheim': ('Lade kirkegård, Trondheim', 'Sør-Trøndelag', 'Norge'),
 'cementerio de la capilla de lade kirke': ('Lade kirkegård, Trondheim', 'Sør-Trøndelag', 'Norge'),
 'bodo trondhjeim': ('Bodø', 'Nordland', 'Norge'), 'vestre fredrikstad': ('Vestre Fredrikstad', 'Østfold', 'Norge'),
 'modum prestegård': ('Modum prestegård, Modum', 'Buskerud', 'Norge'), 'øiestad': ('Øyestad', 'Aust-Agder', 'Norge'),
 'øiestad kirkegård': ('Øyestad kirkegård, Øyestad', 'Aust-Agder', 'Norge'), 'skar øier': ('Skar, Øyer', 'Oppland', 'Norge'),
 'oslo fylke': ('Oslo domkirke, Oslo', 'Akershus', 'Norge'), 'fredriksvern båtsmannsgården': ('Båtsmannsgården, Stavern', 'Vestfold', 'Norge'),
 'høvåg': ('Agerøen, Høvåg', 'Aust-Agder', 'Norge'), 'viker asmaløy hvaler østfold': ('Viker, Asmaløy, Hvaler', 'Østfold', 'Norge'),
 'dikemark jernværk': ('Dikemark jernverk, Asker', 'Akershus', 'Norge'), 'bjerke brandbu': ('Bjerke, Brandbu', 'Oppland', 'Norge'),
 'skaramyra grue': ('Skaramyra, Grue', 'Hedmark', 'Norge'), 'køyen grue': ('Køyen, Grue', 'Hedmark', 'Norge'),
 'nesmoen grue': ('Nesmoen, Grue', 'Hedmark', 'Norge'), 'rud høland akershus 03.02.': ('Rud, Høland', 'Akershus', 'Norge'),
 'sørskogsbygda': ('Sørskogbygda, Elverum', 'Hedmark', 'Norge'), 'styrkesnes indre i sørfold': ('Indre Styrkesnes, Sørfold', 'Nordland', 'Norge'),
 'rossinggården': ('Rossinggården, Tolga', 'Hedmark', 'Norge'), 'haugum, overhalla': ('Haugum, Overhalla', 'Nord-Trøndelag', 'Norge'),
 'fosse, meland': ('Fosse, Meland', 'Hordaland', 'Norge'), 'seim gamle kyrkjegard': ('Seim gamle kyrkjegard, Lindås', 'Hordaland', 'Norge'),
 'straume': ('Straume, Mo, Modalen', 'Hordaland', 'Norge'), 'bårdsgarden': ('Bårdsgarden, Innfjorden, Rauma', 'Møre og Romsdal', 'Norge'),
 'ytstereitane (1-9)': ('Ytstereitane, Dravlaus', None, 'Norge'), 's hauge gravlund': ('Søndre Hauge gravlund, Haugesund', 'Rogaland', 'Norge'),
 'ellingsrudhjemmet': ('Ellingsrudhjemmet, Oslo', 'Akershus', 'Norge'), 'frongner': ('Frogner', None, 'Norge'),
 'fussingø': ('Fussingø, Randers', 'Viborg', 'Danmark'), 'amundebyn, östervallskog': ('Amundebyn, Östervallskog', 'Värmland', 'Sverige'),
 'amundsrød, østervallskog': ('Amundsrød, Östervallskog', 'Värmland', 'Sverige'), 'østre bön, tøcksmark': ('Östra Bön, Töcksmark', 'Värmland', 'Sverige'),
 'klöxhult, stenbrohult': ('Klöxhult, Stenbrohult', 'Kronoberg', 'Sverige'), 'annaborg, hillerød': ('Annaborg, Hillerød', 'Frederiksborg', 'Danmark'),
 'berg sogn, brundlaugnæs': ('Berg, Brunlanes', 'Vestfold', 'Norge'), 'berg sogn, brunlaugnæs': ('Berg, Brunlanes', 'Vestfold', 'Norge'),
 'broby (l), friggatofta': ('Broby, Friggatofta', 'Skåne', 'Sverige'), 'skanderborg s.- hjelmslev h.- skanderborg a.': ('Skanderborg', 'Skanderborg', 'Danmark'),
 'ringkoebing, hind, nysogn, synder lyngvig': ('Søndre Lyngvig, Nysogn', 'Ringkøbing', 'Danmark'), 'provstgaard, nysogn': ('Provstgaard, Nysogn', 'Ringkøbing', 'Danmark'),
 'strandby (gislum': ('Strandby, Gislum', 'Aalborg', 'Danmark'), 'lynderupgaard': ('Lynderupgaard, Lynderup', 'Viborg', 'Danmark'),
 'vennergaard, velling': ('Vennergaard, Velling', 'Ringkøbing', 'Danmark'), 'sønder alslev kirke': ('Sønder Alslev kirke', 'Maribo', 'Danmark'),
 'den haag': ('Haag', 'Sør-Holland', 'Nederland'), 'meckelborgland i bril': ('Meckelborgland', None, 'Nederland'),
}
NOT_PLACE = {'hjemme': 'ikke et sted – flytt til notat', 'forlis på reise til/fra trondheim': 'dødsårsak/omstendighet – flytt til notat',
             'frivillig i fransk krigstjeneste i alger': 'livshendelse – flytt til notat (sted: Alger, Algerie)',
             'king of polen': 'tittel, ikke sted – fjern', 'ã': 'tegnfeil – fjern', 'kapellet under koret': 'del av kirke – trenger kirkenavn',
             'jylland?, danmark?': 'usikkert – bare «Jylland, Danmark»', 'bosatt på elofsbyn': 'Elofsbyn (Sverige?) – flytt «bosatt på» til notat',
             'ryde og senere nakskov': 'to steder – del i to hendelser', 'vestindien': 'Dansk Vestindia (Danmark) – ufullstendig',
             'sunnmøre': 'bare region – Sunnmøre, Møre og Romsdal'}

reg_by_name = collections.defaultdict(list)
for a in adr:
    for nm in {a['s'], a['c']}:
        if nm: reg_by_name[k(nm)].append(a)

rows = []
for c in ctx:
    raw = c['raw']; n = normalize(raw); kr = k(raw)
    uses = c['uses'] or []; persons = sorted({u['p'] for u in uses}); years = [u['y'] for u in uses if u['y']]
    y0 = min(years) if years else None
    votes = collections.Counter(); county = collections.Counter()
    for x in c['ctx'] or []:
        if not x['c']: continue
        w = W[x['r']] * (2 if (y0 and x['y'] and abs(x['y'] - y0) <= 20) else 1)
        votes[x['c']] += w
        if x['co']: county[(x['c'], canon_county(x['co']))] += w
    fam_country = votes.most_common(1)[0][0] if votes else None
    fam_share = votes.most_common(1)[0][1] / sum(votes.values()) if votes else 0
    fam_county = next((co for (ct, co), _ in county.most_common() if ct == fam_country), None)
    first = n['parts'][0] if n['parts'] else raw.strip(" ,'")
    known = next((v for key, v in KNOWN.items() if kr.strip(" ,'").startswith(key)), None)
    reg = reg_by_name.get(k(first), [])
    reg_same = [a for a in reg if a['ct'] == (known[2] if known else fam_country)]
    action, sug, conf, why, target = None, None, None, None, None
    np_key = next((v for key, v in NOT_PLACE.items() if kr.startswith(key)), None)
    if np_key:
        action, sug, conf, why = 'manuell', '', 'lav', np_key
    elif known:
        sug = ', '.join(x for x in [known[0], known[1] if known[2] != 'Norge' else None, known[2]] if x)
        conf = 'høy'; why = 'kjent sted' + (f'; familien bodde i {fam_country}' if fam_country == known[2] else (f'; NB familien ellers i {fam_country}' if fam_country else ''))
        if reg_same: target = reg_same[0]['id']; action = 'koble'
        else: action = 'opprett'
    elif reg_same:
        same_county = [a for a in reg_same if fam_county and canon_county(a['co']) == fam_county]
        a = sorted(same_county or reg_same, key=lambda a: (not a['k'], a['id']))[0]
        sug = a['d'] or ', '.join(x for x in [a['s'], a['c'] if a['c'] != a['s'] else None, canon_county(a['co']) if a['ct'] != 'Norge' else None, a['ct']] if x)
        target = a['id']; action = 'koble'
        conf = 'høy' if fam_share > 0.6 and (same_county or len(reg_same) == 1) else 'middels'
        why = f'finnes i stedsregisteret; familien {round(fam_share*100)} % i {fam_country}' + (f' ({fam_county})' if fam_county else '')
    elif fam_country:
        sug = ', '.join(x for x in [first, fam_county if fam_country == 'Norge' else fam_county, fam_country] if x)
        action = 'opprett'; conf = 'middels' if fam_share > 0.7 else 'lav'
        why = f'land fra familien: {round(fam_share*100)} % av hendelsene til personen, foreldre, søsken og barn i {fam_country}' + (f', mest {fam_county}' if fam_county else '')
    else:
        action, conf, why = 'manuell', 'lav', 'ingen familiekontekst'
    rows.append(dict(antall=cnt.get(raw, 1), raw=raw, forslag=sug or '', sikkerhet=conf, handling=action, koble_til_id=target or '',
                     begrunnelse=why, personer=', '.join(persons[:4]), aar=y0 or ''))
order = {'høy': 0, 'middels': 1, 'lav': 2}
rows.sort(key=lambda r: (order[r['sikkerhet']], -r['antall'], r['raw']))
with open('forslag_steder.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['sikkerhet', 'antall', 'raw', 'forslag', 'handling', 'koble_til_id', 'begrunnelse', 'personer', 'aar'])
    w.writeheader(); w.writerows(rows)
print(collections.Counter(r['sikkerhet'] for r in rows), collections.Counter(r['handling'] for r in rows))
for r in rows[:12] + [r for r in rows if r['sikkerhet'] == 'middels'][:12] + [r for r in rows if r['sikkerhet'] == 'lav'][:14]:
    print(r['sikkerhet'], '|', r['raw'], '->', r['forslag'], '|', r['handling'], r['koble_til_id'], '|', r['begrunnelse'])
