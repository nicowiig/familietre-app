"""Bygger SQL for stedsvask fase 1–2 fra places_raw.json og addresses.json."""
import json, collections
from run import norm, cnt, infer
from normalize import normalize, key_of, area_of, k

addrs = json.load(open('addresses.json'))
def addr_raw(a):
    if a.get('r'): return a['r']
    street = ' '.join(str(x) for x in [a.get('s'), a.get('hn')] if x)
    return ', '.join(x for x in [street, a.get('l'), a.get('c'), a.get('co'), a.get('ct')] if x)
amap = {}
for a in addrs:
    n = normalize(addr_raw(a)); infer(n)
    a['_key'] = key_of(n) if n['status'] == 'ok' and n['country'] and n['parts'] else None
    amap[a['id']] = a

by_key = collections.defaultdict(list)
for a in addrs:
    if a['_key']: by_key[a['_key']].append(a)
GRAN_RANK = {'full_address': 0, 'street': 1, 'locality': 2, 'city': 3, 'county': 4, 'country': 5, 'unknown': 9}
def pick(lst):
    return sorted(lst, key=lambda a: (not a['k'], GRAN_RANK.get(a['g'], 9), a['id']))[0]

def display(n):
    parts = n['parts']
    if n['country'] == 'Norge':
        return ', '.join(parts[:2]) if parts else 'Norge'
    region = n['region'] if n['region'] and (not parts or k(n['region']) != k(parts[-1])) else None
    return ', '.join(x for x in [*parts[:2], region, n['country']] if x)

def short(n):
    if n['street']: return f"{n['street']} {n['house_number']}{n['house_letter'] or ''}"
    return n['parts'][0] if n['parts'] else n['country']

# visningsnavn per nøkkel = fra den vanligste råstrengen
keys = collections.defaultdict(list)
manual = []
for raw, n in norm.items():
    if n['status'] == 'ok' and n['country'] and n['parts'] or (n['status']=='ok' and n.get('granularity')=='country' and n['country']):
        keys[key_of(n)].append(raw)
    else:
        manual.append(raw)

canon = {}      # key -> existing address id
new_places = [] # (key, fields)
for key, raws in keys.items():
    if key in by_key:
        canon[key] = pick(by_key[key])['id']
    else:
        rep = max(raws, key=lambda r: cnt[r]); n = norm[rep]
        if not n['parts'] and n.get('granularity') != 'country': continue
        parts = n['parts']
        g = 'full_address' if n['street'] else n.get('granularity') or ('locality' if len(parts) > 1 else 'city')
        new_places.append(dict(key=key, rep=rep, g=g,
            street=n['street'], hn=n['house_number'], hl=n['house_letter'],
            locality=parts[0] if len(parts) > 1 and not n['street'] else (parts[1] if n['street'] and len(parts) > 2 else None),
            city=None if g in ('county', 'country') else parts[-1],
            county=area_of(n) or (parts[0] if g == 'county' else None),
            country=n['country'], hist=n['hist_name'],
            hreg=n['region'] if n['country'] != 'Norge' else None,
            rode=n['rode'], disp=display(n), short=short(n)))

# duplikater i adresseregisteret (samme nøkkel, by/lokalitet-nivå)
dups = []
for key, lst in by_key.items():
    if len(lst) > 1:
        c = pick(lst)
        for a in lst:
            if a['id'] != c['id'] and a['g'] in ('city', 'locality', 'county', 'country', 'unknown'):
                dups.append((a['id'], c['id']))

print('nøkler', len(keys), 'eksisterende treff', len(canon), 'nye steder', len(new_places), 'duplikater i registeret', len(dups),
      'manuelle råstrenger', len(manual), 'forekomster manuelle', sum(cnt[r] for r in manual),
      'forekomster koblet', sum(cnt[r] for r in norm if r not in set(manual)))
key_disp = {}
for key, raws in keys.items():
    rep = max(raws, key=lambda r: cnt[r]); key_disp[key] = (short(norm[rep]), display(norm[rep]), norm[rep]['hist_name'])
json.dump(dict(key_disp=key_disp, keys={k: v for k, v in keys.items()}, canon=canon, new=new_places, dups=dups, manual=manual,
               norm={r: dict(key=key_of(n), disp=display(n), city=None if n.get('granularity') in ('county','country') else (n['parts'][-1] if n['parts'] else None),
                             area=area_of(n), country=n['country'], hist=n['hist_name']) for r, n in norm.items()}),
          open('plan.json', 'w'), ensure_ascii=False)
