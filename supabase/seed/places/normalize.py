"""
Stedsvask for familietreet.

Prinsipp (som for roller og navn):
  * place_raw bevares alltid (REQ-PLC06)
  * hver råstreng får en nøkkel (sted + land) og kobles til ett kanonisk sted i addresses
  * visning hentes fra det kanoniske stedet, med historisk navn/region som kontekst

Hver komma-del klassifiseres som
  country  – land (alltid norsk form)
  nocounty – norsk fylke/amt (lagres, vises ikke i vanlig visning)
  region   – utenlandsk delstat/amt/provins (lagres og vises for utlandet)
  drop     – støy: herred, moderne danske regioner, «HRR», tomme ledd
  place    – selve stedet (gård, kirke, sogn, by)
"""
import re
import unicodedata

def k(s):
    return re.sub(r'\s+', ' ', s.strip().strip('\'"\\').strip()).lower().rstrip('.')

COUNTRY = {}
def _c(target, *names):
    for n in names: COUNTRY[k(n)] = target
_c('Norge', 'norge', 'norway', 'norw', 'nor', 'nrwy', 'norwegen', 'noreg', 'no', 'norvège', 'norwegia')
_c('Danmark', 'danmark', 'denmark', 'denm', 'danska', 'dänemark', 'danemark', 'dk')
_c('Sverige', 'sverige', 'sweden', 'schweden', 'swe')
_c('Tyskland', 'tyskland', 'germany', 'deutschland', 'deutchland', 'deuchland', 'deutschland(hrr)', 'de', 'tyskland (hrr)')
_c('Polen', 'polen', 'poland', 'polska')
_c('Nederland', 'nederland', 'netherlands', 'the netherlands', 'holland', 'nederlân')
_c('USA', 'usa', 'united states', 'united states of america', 'u.s.a')
_c('Storbritannia', 'storbritannia', 'great britain', 'united kingdom', 'uk')
_c('England', 'england')
_c('Skottland', 'skottland', 'scotland')
_c('Frankrike', 'frankrike', 'france')
_c('Østerrike', 'østerrike', 'österreich', 'austria', 'osterrike')
_c('Ungarn', 'ungarn', 'hungary', 'magyarország')
_c('Finland', 'finland', 'suomi')
_c('Litauen', 'litauen', 'lithuania', 'lietuva')
_c('Brasil', 'brasil', 'brazil')
_c('Russland', 'russland', 'russia')
_c('Sveits', 'sveits', 'switzerland', 'schweiz')
_c('Italia', 'italia', 'italy')
_c('Spania', 'spania', 'spain')
_c('Island', 'island', 'iceland')
_c('Tsjekkia', 'tsjekkia', 'czech republic', 'czechia')
_c('Belgia', 'belgia', 'belgium')
_c('Canada', 'canada')
_c('Australia', 'australia')
_c('Sør-Afrika', 'sør-afrika', 'south africa')

# Norske fylker og amt – alle skrivemåter -> kanonisk navn
NO_COUNTY = {}
def _n(target, *names):
    for n in names: NO_COUNTY[k(n)] = target
_n('Hordaland', 'hordaland', 'ho', 'hordaland county', 'søndre bergenhus amt', 'sondre bergenhus', 'søndre bergenhus')
_n('Sør-Trøndelag', 'sør-trøndelag', 'sor-trondelag', 's-t', 's. trondelag', 's. trøndelag', 'sør trøndelag', 's-trlg', 'sor trondelag',
   'sør trødelag', 's. trondalag', 'sør-trondelag', 'sor-trøndelag', 'søndre trondhjems amt', 's trøndelag', 'sør-trønderlag')
_n('Nord-Trøndelag', 'nord-trøndelag', 'nord-trondelag', 'n-trøndelag', 'n. trøndelag', 'nord trøndelag', 'nordre trondhjems amt', 'n-trlg')
_n('Trøndelag', 'trøndelag', 'trondelag')
_n('Akershus', 'akershus', 'akerhus', 'akershuus', 'akershuus county', 'akershus amt')
_n('Oppland', 'oppland', 'opland', 'oppl', 'kristians amt', 'christians amt')
_n('Buskerud', 'buskerud', 'buskeruds amt')
_n('Vestfold', 'vestfold', 'jarlsberg og larviks amt', 'jarlsberg og laurviks amt')
_n('Aust-Agder', 'aust-agder', 'aust agder', 'nedenes amt', 'nedenæs amt')
_n('Vest-Agder', 'vest-agder', 'vest agder', 'lister og mandal amt', 'lister og mandals amt')
_n('Agder', 'agder')
_n('Østfold', 'østfold', 'ostfold', 'smaalenene', 'smaalenenes amt', 'smålenene')
_n('Hedmark', 'hedmark', 'hedemarkens amt', 'hedemarken')
_n('Innlandet', 'innlandet')
_n('Rogaland', 'rogaland', 'rogaland county', 'stavanger amt')
_n('Møre og Romsdal', 'møre og romsdal', 'more og romsdal', 'romsdals amt', 'møre', 'mr')
_n('Telemark', 'telemark', 'bratsberg amt', 'bratsberg')
_n('Troms', 'troms', 'tromsø amt')
_n('Finnmark', 'finnmark', 'finmarkens amt', 'finmarken')
_n('Nordland', 'nordland', 'nordlands amt', 'nordl')
_n('Sogn og Fjordane', 'sogn og fjordane', 'nordre bergenhus amt', 'nordre bergenhus', 's og fj')
_n('Vestland', 'vestland')
_n('Viken', 'viken')

# Utenlandske regioner (delstat, provins, amt) -> (kanonisk navn, land)
REGION = {}
def _r(target, country, *names):
    for n in names: REGION[k(n)] = (target, country)
_r('Brandenburg', 'Tyskland', 'brandenburg', 'markgrevskapet brandenburg', 'mark brandenburg')
_r('Sachsen', 'Tyskland', 'sachsen', 'saxony', 'saksen', 'kurfyrstedømmet sachsen')
_r('Sachsen-Anhalt', 'Tyskland', 'sachsen-anhalt', 'saxony-anhalt')
_r('Anhalt', 'Tyskland', 'anhalt')
_r('Bayern', 'Tyskland', 'bayern', 'bavaria')
_r('Mecklenburg', 'Tyskland', 'mecklenburg', 'mecklenburg-vorpommern', 'mecklenburg-schwerin')
_r('Holstein', 'Tyskland', 'holstein', 'holsten')
_r('Ditmarsken', 'Tyskland', 'ditmarschen', 'ditmarsken', 'dithmarschen')
_r('Niedersachsen', 'Tyskland', 'niedersachsen', 'lower saxony', 'nedre sachsen')
_r('Hessen', 'Tyskland', 'hessen', 'hesse')
_r('Preussen', 'Tyskland', 'preussen', 'prussia', 'preußen', 'east preussen', 'østpreussen')
_r('Pommern', 'Tyskland', 'pommern', 'pomerania')
_r('Schlesien', 'Polen', 'schlesien', 'silesia', 'niederschlesien', 'lower silesia', 'dolnośląskie', 'dolnoślä', 'województwo dolnośląskie')
_r('Oppeln', 'Polen', 'opolskie', 'województwo opolskie')
_r('Lillepolen', 'Polen', 'małopolskie', 'lesser poland voivodeship', 'kraków county', 'malopolskie')
_r('Świętokrzyskie', 'Polen', 'świętokrzyskie', 'swietokrzyskie', 'świętokrzyskie')
_r('Friesland', 'Nederland', 'fr', 'friesland', 'fryslân')
_r('Jämtland', 'Sverige', 'jämtland', 'jamtland')
_r('Värmland', 'Sverige', 'värmland', 'varmland')
_r('Bohuslän', 'Sverige', 'bohuslän', 'bohuslan')
_r('Älvsborg', 'Sverige', 'älvsborg', 'alvsborg')
_r('Skåne', 'Sverige', 'skåne', 'skane')
_r('Slesvig', 'Danmark', 'slesvig', 'schleswig', 'sønderjylland')
_r('Slesvig-Holsten', 'Tyskland', 'slesvig-holstein', 'slesvig-holsten', 'schleswig-holstein')
# Danske amt (historisk inndeling, nyttig i visning for Danmark)
for amt in ['ringkøbing', 'aalborg', 'viborg', 'københavns', 'frederiksborg', 'maribo', 'svendborg', 'præstø', 'odense', 'randers',
            'vejle', 'ribe', 'skanderborg', 'aarhus', 'holbæk', 'sorø', 'thisted', 'hjørring', 'bornholms', 'haderslev']:
    name = amt.capitalize().replace('Københavns', 'København').replace('Bornholms', 'Bornholm')
    for v in [amt, amt + ' amt', amt + ' a', amt.replace('ø', 'o').replace('æ', 'ae').replace('å', 'aa')]:
        REGION[k(v)] = (name, 'Danmark')
_r('Ringkøbing', 'Danmark', 'ringkobing', 'ringkøbing a.', 'ringkobing amt')
_r('Sjælland', 'Danmark', 'sjælland', 'sjaelland', 'zealand')
_r('Fyn', 'Danmark', 'fyn', 'fyen', 'funen')
_r('Falster', 'Danmark', 'falster')
_r('Lolland', 'Danmark', 'lolland')
_r('Yorkshire', 'England', 'yorkshire', 'yorkshire (west riding)')
_r('Northumberland', 'England', 'northumberland')
_r('Suffolk', 'England', 'suffolk')
_r('New York', 'USA', 'new york state', 'ny')
_r('California', 'USA', 'california')
_r('Michigan', 'USA', 'michigan')
_r('Illinois', 'USA', 'illinois')
_r('Minnesota', 'USA', 'minnesota')
_r('Wisconsin', 'USA', 'wisconsin')

# Støy som ikke er en del av stedet
DROP_EXACT = {k(x) for x in [
    'hrr', 'det hellige romerske rike', 'det tysk-romerske rike', 'holy roman empire', 'of', '', 'ã',
    'hovedstaden', 'region hovedstaden', 'capital region of danmark', 'capital region of denmark', 'region sjælland',
    'region midtjylland', 'region nordjylland', 'region syddanmark', 'midtjylland', 'nordjylland', 'syddanmark',
    'storstrøm', 'storstrom', 'hind', 'kær', 'sokkelund', 'sallinge', 'bøvling herred', 'vesterålen', 'lofoten', 'gudbrandsdalen', 'hadeland', 'toten', 'hedemarken', 'romerike', 'sunnmøre', 'nordmøre', 'helgeland', 'sogn', 'hardanger', 'midthordland', 'distr of midthordland', 'direktionsbezirk dresden', 'dresden government region', 'stadt dresden', 'kreisfreie stadt',
]}
DROP_RE = re.compile(r'(?i)^((.*\s)?(herred|h\.|county|kommune|kreds\s*\d*|government region|regierungsbezirk|landkreis|kreis)|bn\.?\s*\d+|gnr\.?\s*\d+.*|salten)$')

# Historiske bynavn -> (moderne navn, land) ; historisk navn bevares som kontekst
HIST_CITY = {
    'kristiania': ('Oslo', 'Norge'), 'christiania': ('Oslo', 'Norge'), 'oslo by': ('Oslo', 'Norge'),
    'trondhjem': ('Trondheim', 'Norge'), 'nidaros': ('Trondheim', 'Norge'),
    'fredriksvern': ('Stavern', 'Norge'), 'fredriksværn': ('Stavern', 'Norge'), 'fredriksvaern': ('Stavern', 'Norge'),
    'cölln an der spree': ('Berlin', 'Tyskland'), 'cölln a d spree': ('Berlin', 'Tyskland'), 'cölln': ('Berlin', 'Tyskland'),
    'brieg': ('Brzeg', 'Polen'), 'breslau': ('Wrocław', 'Polen'), 'oppeln': ('Opole', 'Polen'), 'neisse': ('Nysa', 'Polen'),
    'liegnitz': ('Legnica', 'Polen'), 'königsberg': ('Kaliningrad', 'Russland'),
}
# Rene stavefeil/eksonymer for by (ingen historisk kontekst)
CITY_FIX = {
    'copenhagen': 'København', 'kobenhavn': 'København', 'kjøbenhavn': 'København', 'kiøbenhavn': 'København',
    'alesund': 'Ålesund', 'aalesund': 'Ålesund', 'krakow': 'Kraków', 'cracow': 'Kraków', 'vienna': 'Wien',
    'munich': 'München', 'cologne': 'Köln', 'warsaw': 'Warszawa', 'prague': 'Praha', 'statsbygd': 'Stadsbygd',
    'holand': 'Høland', 'høland i akershus': 'Høland', 'akerhus festning': 'Akershus festning', 'dahltorp': 'Daltorp',
    'faaborg': 'Fåborg', 'andoy': 'Andøy', 'alingsas': 'Alingsås', 'nykobing': 'Nykøbing',
}
CHURCH_CITY = {
    'korskirken': {'Hordaland': 'Bergen'}, 'nykirken': {'Hordaland': 'Bergen'}, 'mariakirken': {'Hordaland': 'Bergen'},
    'johanneskirken': {'Hordaland': 'Bergen'}, 'st. jakob kirke': {'Hordaland': 'Bergen'},
    'domkirken': {'Hordaland': 'Bergen', 'Sør-Trøndelag': 'Trondheim', 'Akershus': 'Oslo', 'Oslo': 'Oslo', 'Rogaland': 'Stavanger'},
    'vår frue kirke': {'Sør-Trøndelag': 'Trondheim'}, 'vor frue kirke': {'Sør-Trøndelag': 'Trondheim'},
}
SOKN_RE = re.compile(r'(?i)\s+(sokn|sogn|prestegjeld|prestegjeld\.|parish|landsogn|domsogn|landsförsamling|församling|s\.)$')

def fix_encoding(s):
    if re.search(r'Ã|Ä[\u0080-¿]|Å[\u0080-¿]|Ä[™›]', s):
        try:
            return s.encode('cp1252', errors='strict').decode('utf-8')
        except Exception:
            try:
                return s.encode('latin-1', errors='strict').decode('utf-8')
            except Exception:
                return s
    return s

def titlecase_if_upper(p):
    if p.isupper() and len(p) > 3:
        return ' '.join(w.capitalize() for w in p.lower().split(' '))
    if p.islower() and len(p) > 2:
        return ' '.join(w.capitalize() if w not in ('og', 'i', 'an', 'der', 'am', 'de') else w for w in p.split(' '))
    return p

STREET_RE = re.compile(r'^(?P<street>[^\d,]*?[A-Za-zÆØÅæøåÄÖÜäöüé\.]\s*)\s(?P<num>\d+)\s*(?P<letter>[a-zA-Z])?$')
RODE_RE = re.compile(r'^\d{1,3}-\d{1,3}$')
DATE_PREFIX_RE = re.compile(r'^\d{4}[.\-]\d{2}[.\-]\d{2}\s+')
NOT_PLACE_RE = re.compile(r'(?i)(regiment|kompani|bataljon|infanteri|dragon|skvadron)')

def normalize(raw):
    """-> dict(key, parts, country, county, region, hist_name, street, rode, status, reason)"""
    out = dict(raw=raw, parts=[], country=None, county=None, region=None, hist_name=None,
               street=None, house_number=None, house_letter=None, rode=None, status='ok', reason=None)
    s = fix_encoding(raw or '')
    s = DATE_PREFIX_RE.sub('', s.strip().strip('\'"\\').strip())
    if NOT_PLACE_RE.search(s):
        out.update(status='manual', reason='ikke et sted (militær enhet)')
        return out
    # «Bergen (Korskirken)» -> «Korskirken, Bergen»
    s = re.sub(r'^([^,(]+)\s*\(([^)]+)\)', lambda m: f"{m.group(2)}, {m.group(1)}" if not re.search(r'(?i)gaard|gård', m.group(2)) else m.group(1), s)
    s = re.sub(r'\s*\((gaard|gård)\)', '', s, flags=re.I)
    s = s.replace('/', ',').replace(' - ', ', ')
    # «Trondheim Norge», «Vermeland Sverige» -> eget landledd
    s = re.sub(r'(?i)\s+(norge|norway|sverige|danmark|denmark|tyskland)$', r', \1', s)
    # «Korskirken i Bergen», «Frogner i Sørum», «Bergen i Hordaland» -> to ledd
    s = re.sub(r'(?<![A-Za-zÆØÅæøå])([A-ZÆØÅ][^,]*?) i ([A-ZÆØÅ][^,]*)', r'\1, \2', s)
    # «Nordre gravlund Oslo» -> «Nordre gravlund, Oslo»
    s = re.sub(r'(?i)\b(gravlund|kirkegård|kirke|kirken|kapell)\s+([A-ZÆØÅ][a-zæøå]+)$', r'\1, \2', s)
    raw_parts = [p for p in (x.strip().strip('\'"\\').strip() for x in s.split(',')) if p != '']
    places = []
    first_is_county = bool(raw_parts) and k(raw_parts[0]) in NO_COUNTY and len(raw_parts) > 2
    for p in raw_parts:
        kp = k(p)
        if kp in COUNTRY:
            out['country'] = out['country'] or COUNTRY[kp]; continue
        if kp in NO_COUNTY and not (kp == 'oslo'):
            out['county'] = NO_COUNTY[kp]; out['country'] = out['country'] or 'Norge'; continue
        if kp in REGION:
            reg, ctry = REGION[kp]
            out['region'] = out['region'] or reg
            out['_region_country'] = ctry
            continue
        if kp in DROP_EXACT or DROP_RE.match(p):
            continue
        if RODE_RE.match(p):
            out['rode'] = p; continue
        if kp in HIST_CITY:
            modern, ctry = HIST_CITY[kp]
            out['hist_name'] = p if not p.islower() else p.capitalize()
            out['_hist_country'] = ctry
            p = modern
        elif kp in CITY_FIX:
            p = CITY_FIX[kp]
        p = SOKN_RE.sub('', p).strip()
        p = re.sub(r'(?i)^paa\s+', '', p)
        p = titlecase_if_upper(p)
        if places and k(places[-1]) == k(p):
            continue  # «Bergen, Bergen»
        places.append(p)
    if first_is_county:
        places = list(reversed(places))
    # land: eksplisitt > fra region > fra historisk by
    if not out['country']:
        out['country'] = out.pop('_region_country', None) or out.pop('_hist_country', None)
    out.pop('_region_country', None); out.pop('_hist_country', None)
    # gateadresse i første ledd
    if places:
        m = STREET_RE.match(places[0])
        if m and len(places) > 1:
            out['street'] = m.group('street').strip()
            out['house_number'] = int(m.group('num'))
            out['house_letter'] = (m.group('letter') or '').upper() or None
    if out['country'] == 'Norge' and out['region'] and out['region'] not in ('Slesvig',):
        out['region'] = None
    # Kirker uten by: by fra fylket
    if len(places) == 1 and k(places[0]) in CHURCH_CITY:
        city = CHURCH_CITY[k(places[0])].get(out['county'])
        if city: places.append(city)
    if not places and (out['county'] or out['region']):
        places = [out['county'] or out['region']]
        out['granularity'] = 'county'
    if out['country'] == 'Norge':
        places = ['Vår Frue kirke' if k(x) in ('vor frue kirke', 'vår frue kirke', 'vor frues kirke') else x for x in places]
    out['parts'] = places
    if not places and out['country']:
        out['granularity'] = 'country'
    if not places and not out['country']:
        out.update(status='manual', reason='tomt eller uleselig')
    return out

def area_of(n):
    """Fylke for Norge, region for utlandet – skiller f.eks. Gran (Hadeland) fra Gran (Hedmark)."""
    a = n['county'] if n['country'] == 'Norge' else n['region']
    return a if a and (not n['parts'] or k(a) != k(n['parts'][-1])) else ''

def key_of(n):
    return ' | '.join(k(x) for x in n['parts']) + ' @ ' + k(area_of(n)) + ' # ' + (n['country'] or '?')
