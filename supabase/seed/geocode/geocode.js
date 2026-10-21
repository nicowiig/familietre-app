// Kjøres i nettleseren (Nominatim-fanen). Geokoder steder sekvensielt og legger resultatet i window.__res.
// Kartverket (stedsnavn-API) for Norge, Nominatim (OpenStreetMap) ellers og som reserve. Maks ~1 kall/sek mot Nominatim.
window.__res = window.__res || {};
window.__log = window.__log || [];
const FYLKE = {
  'Hordaland': 'Vestland', 'Sogn og Fjordane': 'Vestland', 'Vestland': 'Vestland',
  'Sør-Trøndelag': 'Trøndelag', 'Nord-Trøndelag': 'Trøndelag', 'Trøndelag': 'Trøndelag',
  'Oppland': 'Innlandet', 'Hedmark': 'Innlandet', 'Innlandet': 'Innlandet',
  'Aust-Agder': 'Agder', 'Vest-Agder': 'Agder', 'Agder': 'Agder', 'Austagder': 'Agder',
  'Akershus': 'Akershus', 'Oslo': 'Oslo', 'Østfold': 'Østfold', 'Buskerud': 'Buskerud', 'Vestfold': 'Vestfold',
  'Telemark': 'Telemark', 'Rogaland': 'Rogaland', 'Møre og Romsdal': 'Møre og Romsdal', 'Nordland': 'Nordland',
  'Troms': 'Troms', 'Finnmark': 'Finnmark', 'Viken': 'Akershus',
};
const norm = s => (s || '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastNom = 0;
async function nominatim(q, cc) {
  const wait = 1100 - (Date.now() - lastNom); if (wait > 0) await sleep(wait);
  lastNom = Date.now();
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=no&q=${encodeURIComponent(q)}${cc ? '&countrycodes=' + cc : ''}`;
  try { const r = await fetch(u); if (!r.ok) return null; const j = await r.json(); return j[0] || null } catch { return null }
}
async function kartverket(name, fylke, city) {
  const u = `https://ws.geonorge.no/stedsnavn/v1/navn?sok=${encodeURIComponent(name)}&fuzzy=false&utkoordsys=4258&treffPerSide=30`;
  try {
    const j = await fetch(u).then(r => r.json());
    const hits = (j.navn || []).filter(n => norm(n.skrivemåte) === norm(name));
    if (!hits.length) return null;
    const f = FYLKE[fylke];
    const byFylke = f ? hits.filter(n => (n.fylker || []).some(x => norm(x.fylkesnavn) === norm(f))) : hits;
    const pool = byFylke.length ? byFylke : (f ? [] : hits);
    if (!pool.length) return null;
    const c = norm(city);
    const byKommune = c ? pool.filter(n => (n.kommuner || []).some(k => norm(k.kommunenavn).startsWith(c) || c.startsWith(norm(k.kommunenavn)))) : [];
    const pick = (byKommune[0] || (pool.length === 1 ? pool[0] : null));
    if (!pick) return { ambiguous: pool.length };
    return { lat: pick.representasjonspunkt.nord, lon: pick.representasjonspunkt.øst,
             label: `${pick.skrivemåte} (${pick.navneobjekttype}), ${(pick.kommuner || []).map(k => k.kommunenavn).join('/')}` };
  } catch { return null }
}
window.__geo = async function (items) {
  for (const [id, country, cc, name, short, city, county, street] of items) {
    if (window.__res[id]) continue;
    let res = null;
    try {
      if (cc === 'no') {
        if (street) {
          const n = await nominatim(`${street}, ${city}, Norge`, 'no');
          if (n) res = { lat: +n.lat, lon: +n.lon, src: 'nominatim', prec: 'adresse', label: n.display_name };
        }
        if (!res) {
          const k = await kartverket(short, county, city !== short ? city : '');
          if (k && k.lat) res = { lat: k.lat, lon: k.lon, src: 'kartverket', prec: 'sted', label: k.label };
          else if (k && k.ambiguous) res = { ambiguous: k.ambiguous };
        }
        if (!res || res.ambiguous) {
          const amb = res?.ambiguous;
          const q = [short, city !== short ? city : null, 'Norge'].filter(Boolean).join(', ');
          const n = await nominatim(q, 'no');
          if (n) res = { lat: +n.lat, lon: +n.lon, src: 'nominatim', prec: 'sted', label: n.display_name, note: amb ? `Kartverket: ${amb} like navn` : undefined };
        }
        if (!res && city && city !== short) {
          const n = await nominatim(`${city}, Norge`, 'no');
          if (n) res = { lat: +n.lat, lon: +n.lon, src: 'nominatim', prec: 'omtrent (by/kommune)', label: n.display_name };
        }
      } else {
        let n = await nominatim(name, cc);
        let prec = 'sted';
        if (!n && short && short !== name) n = await nominatim([short, country].join(', '), cc);
        if (!n && city && city !== short) { n = await nominatim([city, country].join(', '), cc); prec = 'omtrent (by/region)'; }
        if (n) res = { lat: +n.lat, lon: +n.lon, src: 'nominatim', prec, label: n.display_name };
      }
    } catch (e) { res = { error: String(e) } }
    window.__res[id] = res || { none: true };
  }
  window.__log.push(`ferdig ${items.length}`);
};
'klar'
