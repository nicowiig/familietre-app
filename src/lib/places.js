/**
 * Stedsvisning – én kilde for hvordan steder skrives.
 *
 * Et sted (rad i addresses, koblet via person_facts.place_id / families.marr_place_id) har
 *   name_short   «Meißen», «Korskirken»
 *   name_display «Meißen, Sachsen, Tyskland», «Korskirken, Bergen» (norske steder uten fylke)
 *   historical_name «Kristiania», «Cölln an der Spree»
 * Rå kildetekst (place_raw) vises bare når stedet ikke er koblet ennå.
 */

/** Kort navn: by eller sted. */
export function placeShort(place, fallback) {
  return place?.name_short || place?.city || fallback || null
}

/** Visningsnavn: sted, by (og region/land for utlandet). */
export function placeLabel(place, fallback) {
  return place?.name_display || place?.name_short || place?.city || fallback || null
}

const SCANDINAVIAN_LOST = {
  // Landskap som tilhørte Danmark-Norge før freden i Brømsebro (1645) og Roskilde (1658)
  'Jämtland':  { until: 1645, then: 'Danmark-Norge (norsk)' },
  'Härjedalen': { until: 1645, then: 'Danmark-Norge (norsk)' },
  'Bohuslän':  { until: 1658, then: 'Danmark-Norge (norsk)' },
  'Skåne':     { until: 1658, then: 'Danmark-Norge (dansk)' },
  'Blekinge':  { until: 1658, then: 'Danmark-Norge (dansk)' },
  'Halland':   { until: 1658, then: 'Danmark-Norge (dansk)' },
  'Kristianstad': { until: 1658, then: 'Danmark-Norge (dansk)' },
}

/**
 * Historisk kontekst for et sted på et gitt tidspunkt: «Danmark-Norge», «Det tysk-romerske rike».
 * Returnerer null når dagens stat er den samme som den gang.
 */
export function historicalContext(place, year) {
  if (!place || !year) return null
  const country = place.country
  const region = place.historical_region || place.county
  const parts = []
  if (place.historical_name) parts.push(place.historical_name)

  let state = null
  if (country === 'Norge') {
    if (year < 1814) state = 'Danmark-Norge'
    else if (year < 1905) state = 'unionen Sverige-Norge'
  } else if (country === 'Danmark') {
    if (year >= 1380 && year < 1814) state = 'Danmark-Norge'
  } else if (country === 'Sverige') {
    const lost = SCANDINAVIAN_LOST[region]
    if (lost && year < lost.until) state = lost.then
  } else if (['Tyskland', 'Østerrike', 'Tsjekkia'].includes(country)) {
    if (year < 1806) state = 'Det tysk-romerske rike'
    else if (country === 'Tyskland' && year < 1871) state = region ? `${region} (Det tyske forbund)` : 'Det tyske forbund'
    else if (country === 'Tyskland' && year < 1918) state = 'Det tyske keiserriket'
  } else if (country === 'Polen') {
    if (region === 'Schlesien') state = year < 1742 ? 'Schlesien, under Böhmen' : year < 1945 ? 'Schlesien, Preussen/Tyskland' : null
    else if (year >= 1569 && year < 1795) state = 'Polen-Litauen'
    else if (year >= 1795 && year < 1918) state = 'delt mellom Preussen, Russland og Østerrike'
  } else if (country === 'Litauen') {
    if (year >= 1569 && year < 1795) state = 'Polen-Litauen'
  } else if (country === 'Finland') {
    if (year < 1809) state = 'Sverige'
    else if (year < 1917) state = 'Storfyrstedømmet Finland (Russland)'
  } else if (country === 'Island') {
    if (year < 1918) state = 'Danmark'
  }
  if (state) parts.push(state)
  return parts.length ? `den gang ${parts.join(', ')}` : null
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
  const q = placeLabel(place, fallback)
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

/** Kolonner som hentes når et sted embeddes i en spørring. */
export const PLACE_SELECT = 'id, name_short, name_display, city, county, country, historical_name, historical_region, coordinates_lat, coordinates_lng'
