import json, collections
from normalize import normalize, key_of, k, REGION, area_of
import re
raws = json.load(open('places_raw.json'))
norm = {r['raw']: normalize(r['raw']) for r in raws}
cnt = {r['raw']: r['n'] for r in raws}
# Indeks: stedsnavn -> land og område (fylke/region), fra strenger der det er oppgitt
BASE = lambda p: k(re.sub(r'(?i)\s+(kirke|kirken|kirkegård|gravlund|kapell|sokn|prestegård)$', '', p))
idx_c = collections.defaultdict(collections.Counter)
idx_a = collections.defaultdict(collections.Counter)
for raw, n in norm.items():
    if n['country'] and n['parts']:
        last = BASE(n['parts'][-1])
        idx_c[last][n['country']] += cnt[raw]
        idx_c[BASE(n['parts'][0])][n['country']] += cnt[raw]
        if area_of(n): idx_a[(last, n['country'])][area_of(n)] += cnt[raw]
def dominant(c):
    if not c: return None
    top, tn = c.most_common(1)[0]
    return top if tn >= 0.8 * sum(c.values()) else None
def infer(n):
    if not n['parts']: return
    if not n['country']:
        for p in [n['parts'][-1], n['parts'][0]]:
            if k(p) in REGION: n['country'] = REGION[k(p)][1]; break
            d = dominant(idx_c.get(BASE(p)))
            if d: n['country'] = d; n['inferred'] = True; break
    if n['country'] and not area_of(n):
        c = idx_a.get((BASE(n['parts'][-1]), n['country']))
        a = dominant(c)
        if a:
            if n['country'] == 'Norge': n['county'] = a
            else: n['region'] = a
        elif c and len(c) > 1:
            n['ambiguous'] = sorted(c)
for n in norm.values(): infer(n)
if __name__ == '__main__':
    keys = collections.defaultdict(list)
    for raw, n in norm.items():
        if n['status'] == 'ok': keys[key_of(n)].append(raw)
    nocountry = [(cnt[r], r, key_of(n)) for r, n in norm.items() if n['status']=='ok' and not n['country']]
    amb = [(cnt[r], r, n['ambiguous']) for r, n in norm.items() if n.get('ambiguous')]
    print('tvetydige', len(amb)); [print(x) for x in sorted(amb, reverse=True)[:15]]
    manual = [(cnt[r], r, n['reason']) for r, n in norm.items() if n['status']!='ok']
    print('råstrenger', len(norm), 'nøkler', len(keys), 'uten land', len(nocountry), sum(x[0] for x in nocountry), 'manuelle', len(manual))
    print('--- største klynger'); 
    for key, rs in sorted(keys.items(), key=lambda kv: -sum(cnt[r] for r in kv[1]))[:25]: print(sum(cnt[r] for r in rs), len(rs), key)
    print('--- uten land (topp)'); 
    for x in sorted(nocountry, reverse=True)[:40]: print(x)
    print('--- manuelle'); 
    for x in sorted(manual, reverse=True)[:20]: print(x)
    json.dump({r: n for r, n in norm.items()}, open('normalized.json','w'), ensure_ascii=False, indent=0)
