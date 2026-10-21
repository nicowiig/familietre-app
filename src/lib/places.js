/**
 * Stedsvisning – én kilde for hvordan steder skrives.
 *
 * Et sted (rad i addresses, koblet via person_facts.place_id / families.marr_place_id) har en fast identitet
 * og dagens navn (name_short «Meißen», name_display «Meißen, Sachsen, Tyskland»).
 * Navn og rike som varierer over tid ligger i place_name_periods og place_jurisdictions, og settes sammen
 * her ut fra hendelsens årstall og valgt visningsform:
 *
 *   historisk  Kristiania, unionen Sverige-Norge   (nå Oslo, Norge)
 *   blandet    Kristiania (nå Oslo)                 den gang unionen Sverige-Norge     ← standard
 *   moderne    Oslo                                 den gang Kristiania, unionen Sverige-Norge
 *
 * Rå kildetekst (place_raw) vises bare når stedet ikke er koblet ennå.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

/** Kolonner som hentes når et sted embeddes i en spørring. */
export const PLACE_SELECT = 'id, name_short, name_display, city, county, country, historical_name, historical_region, coordinates_lat, coordinates_lng, granularity, building_name'

// ---------- Tidsdata (lastes én gang per økt) ----------
let jurisdictions = []   // { country, region, address_id, polity, description, from, to }
let namePeriods = []     // { modern_name, country, address_id, name, from, to }

export async function loadPlaceTimeData() {
  const [j, n] = await Promise.all([
    supabase.from('place_jurisdictions').select('country, region, address_id, valid_from, valid_to, polity:polity_id(name, description)'),
    supabase.from('place_name_periods').select('modern_name, country, address_id, historical_name, valid_from, valid_to'),
  ])
  if (!j.error) jurisdictions = (j.data || []).map(r => ({ ...r, polity: r.polity?.name, description: r.polity?.description }))
  if (!n.error) namePeriods = n.data || []
  return !j.error && !n.error
}

const within = (r, y) => (r.valid_from == null || y >= r.valid_from) && (r.valid_to == null || y <= r.valid_to)
const same = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase()

/** Hva het stedet det aktuelle året? null når navnet er det samme som i dag. */
export function historicalNameAt(place, year) {
  if (!place || !year) return null
  const byId = namePeriods.find(r => r.address_id === place.id && within(r, year))
  const byName = byId || namePeriods.find(r => !r.address_id && same(r.country, place.country)
    && (same(r.modern_name, place.city) || same(r.modern_name, place.name_short)) && within(r, year))
  return byName ? { name: byName.historical_name, modern: byName.modern_name } : null
}

/** Hvilket rike hørte stedet til det aktuelle året? null når det er dagens land. */
export function polityAt(place, year) {
  if (!place || !year) return null
  const region = place.historical_region || place.county
  const hit = jurisdictions.find(r => r.address_id === place.id && within(r, year))
    || jurisdictions.find(r => !r.address_id && same(r.country, place.country) && r.region && same(r.region, region) && within(r, year))
    || jurisdictions.find(r => !r.address_id && same(r.country, place.country) && !r.region && within(r, year))
  if (!hit || same(hit.polity, place.country)) return null
  return { name: hit.polity, description: hit.description }
}

// ---------- Visningsform (per bruker, husket i nettleseren) ----------
const MODE_KEY = 'familietre.stedsvisning'
export const PLACE_MODES = [
  { id: 'historisk', label: 'Historisk' },
  { id: 'blandet',   label: 'Begge' },
  { id: 'moderne',   label: 'Dagens' },
]
function readMode() {
  try { return localStorage.getItem(MODE_KEY) || 'blandet' } catch { return 'blandet' }
}
let currentMode = readMode()
const listeners = new Set()
export function setPlaceMode(m) {
  currentMode = m
  try { localStorage.setItem(MODE_KEY, m) } catch { /* privat modus */ }
  listeners.forEach(fn => fn(m))
}
/** React-hook: gjeldende visningsform, oppdateres når den endres. */
export function usePlaceMode() {
  const [m, setM] = useState(currentMode)
  useEffect(() => { listeners.add(setM); return () => listeners.delete(setM) }, [])
  return [m, setPlaceMode]
}

// ---------- Formatering ----------
function replaceName(text, from, to) {
  if (!text || !from) return text
  const re = new RegExp(`(^|, )${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=,|$)`)
  return re.test(text) ? text.replace(re, `$1${to}`) : null
}

/**
 * Sted for en hendelse: { label, context, title }.
 *  label   – hovedteksten
 *  context – tilleggsteksten i parentes/kursiv (kan være null)
 *  title   – utfyllende forklaring (verktøytips)
 */
export function placeAt(place, year, fallback, mode = currentMode) {
  if (!place) return { label: fallback || null, context: null, title: null }
  const modern = place.name_display || place.name_short || place.city || fallback || ''
  const hist = historicalNameAt(place, year)
  const pol = polityAt(place, year)
  const isNorway = place.country === 'Norge'
  const title = pol?.description ? `${pol.name}: ${pol.description}` : null

  if (mode === 'moderne') {
    const bits = [hist?.name, pol?.name].filter(Boolean)
    return { label: modern, context: bits.length ? `den gang ${bits.join(', ')}` : null, title }
  }
  const replaced = hist ? replaceName(modern, hist.modern, hist.name) : null
  let label = replaced || modern
  // Når det gamle navnet ikke står i teksten (f.eks. en bydel), nevnes det i konteksten i stedet
  const histInContext = hist && !replaced
  if (mode === 'historisk') {
    if (pol) {
      label = isNorway ? `${label}, ${pol.name}` : (label.endsWith(place.country) ? label.slice(0, -place.country.length) + pol.name : `${label}, ${pol.name}`)
    }
    const changed = replaced || pol
    const ctx = [histInContext ? `den gang ${hist.name}` : null, changed ? `nå ${modern}${isNorway && pol ? ', Norge' : ''}` : null].filter(Boolean)
    return { label, context: ctx.length ? ctx.join(' · ') : null, title }
  }
  // blandet
  const bits = []
  if (replaced) bits.push(`nå ${hist.modern}`)
  if (histInContext) bits.push(`den gang ${hist.name}`)
  if (pol) bits.push(`den gang ${pol.name}`)
  return { label, context: bits.length ? bits.join(' · ') : null, title }
}

/** Adresser, gater og bygninger (sykehus, kirker, klinikker) vises med byen på toppen av personsiden. */
function headlineName(place) {
  if (!place) return null
  const isAddress = ['full_address', 'street'].includes(place.granularity) || !!place.building_name
  return (isAddress && place.city) ? place.city : (place.name_short || place.city)
}

/** Kort navn (toppen av personsiden): «Kristiania» / «Oslo» avhengig av visningsform. */
export function placeShortAt(place, year, fallback, mode = currentMode) {
  const short = headlineName(place) || fallback || null
  if (!place || mode === 'moderne') return short
  const hist = historicalNameAt(place, year)
  return hist && same(hist.modern, short) ? hist.name : short
}

/** Notater som bare gjentar historisk stat («HRR») skal ikke vises – konteksten beregnes nå. */
export function isRedundantPlaceNote(note) {
  return !!note && /^\s*(\(?hrr\)?|det (hellige|tysk)-?\s*romerske rike)\s*$/i.test(note)
}

/** Kartlenke: koordinater når de finnes, ellers navnet. */
export function placeMapsUrl(place, fallback) {
  if (place?.coordinates_lat && place?.coordinates_lng) {
    return `https://www.google.com/maps/search/?api=1&query=${place.coordinates_lat},${place.coordinates_lng}`
  }
  const q = place?.name_display || place?.name_short || place?.city || fallback
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}
