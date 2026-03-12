/**
 * Norsk datoformatering og hjelpeformater for slektsapp
 */

const MÅNEDER = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

/**
 * Formater år, måned og dag til norsk tekstdato.
 * Eksempler:
 *   formatDate(1927, 11, 5)  → "5. november 1927"
 *   formatDate(1927, 11)     → "november 1927"
 *   formatDate(1927)         → "1927"
 *   formatDate(null)         → null
 */
export function formatDate(year, month, day) {
  if (!year) return null
  if (month && day) {
    return `${day}. ${MÅNEDER[month - 1]} ${year}`
  }
  if (month) {
    return `${MÅNEDER[month - 1]} ${year}`
  }
  return String(year)
}

/**
 * Formater en dato-tekst fra databasen (kan være "1927-11-05", "11. november 1927" e.l.)
 * Returner som norsk tekst.
 */
export function formatDateText(dateText, year, month, day) {
  // Prøv strukturerte felt først
  const structured = formatDate(year, month, day)
  if (structured) return structured
  // Fall tilbake på fritekst
  return dateText || null
}

/**
 * Formater leveår for en person: "1867 – 1938" eller "f. 1878"
 */
export function formatLifespan(birthYear, deathYear, isLiving) {
  if (!birthYear && !deathYear) return null
  if (isLiving) return birthYear ? `f. ${birthYear}` : null
  if (birthYear && deathYear) return `${birthYear} – ${deathYear}`
  if (birthYear) return `f. ${birthYear}`
  return `d. ${deathYear}`
}

/**
 * Regn ut alder basert på fødselsår og dødsår
 */
export function calcAge(birthYear, deathYear) {
  if (!birthYear) return null
  const end = deathYear || new Date().getFullYear()
  return end - birthYear
}

/**
 * Kort datovisning: "5. nov. 1927"
 */
export function formatDateShort(year, month, day) {
  if (!year) return null
  const KORT = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'jun.',
                'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'des.']
  if (month && day) return `${day}. ${KORT[month - 1]} ${year}`
  if (month) return `${KORT[month - 1]} ${year}`
  return String(year)
}

/**
 * Finn fødselsdato og dødsdato fra en liste med person_facts.
 * Håndterer blanding av GEDCOM-koder ("BIRT") og fulle engelske ord ("birth").
 */
const BIRTH_TYPES       = new Set(['BIRT', 'BIRTH'])
const DEATH_TYPES       = new Set(['DEAT', 'DEATH'])
const CHRISTENING_TYPES = new Set(['CHR', 'BAPM', 'BAPTISM', 'CHRISTENING'])
const BURIAL_TYPES      = new Set(['BURI', 'BURIAL'])

export function extractBirthDeath(facts) {
  if (!facts) return { birth: null, death: null, christening: null, burial: null }
  const up = f => f.fact_type?.toUpperCase() || ''
  const birth       = facts.find(f => BIRTH_TYPES.has(up(f)))
  const death       = facts.find(f => DEATH_TYPES.has(up(f)))
  const christening = facts.find(f => CHRISTENING_TYPES.has(up(f)))
  const burial      = facts.find(f => BURIAL_TYPES.has(up(f)))
  return { birth, death, christening, burial }
}

/**
 * Formater et sted til klikkbar Google Maps-lenke
 */
export function mapsUrl(place) {
  if (!place) return null
  return `https://www.google.com/maps/search/${encodeURIComponent(place)}`
}

/**
 * Dagens dato som norsk tekst: "10. mars 2026"
 */
export function todayNorwegian() {
  const d = new Date()
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/**
 * Sjekk om en dato (year, month, day) er i dag (ignorer år)
 */
export function isToday(month, day) {
  if (!month || !day) return false
  const d = new Date()
  return d.getMonth() + 1 === month && d.getDate() === day
}

/**
 * Parser rå datostreng fra families.marr_date.
 * Støtter ISO ("1934-11-05"), GEDCOM ("5 NOV 1927") og årstall ("1934").
 */
const ENG_MONTHS = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

export function parseFamilyDate(dateStr) {
  if (!dateStr) return null
  // ISO: "1934-11-05"
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return formatDate(+iso[1], +iso[2], +iso[3])
  // GEDCOM: "5 NOV 1927"
  const ged = dateStr.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i)
  if (ged) {
    const month = ENG_MONTHS[ged[2].toUpperCase()]
    if (month) return formatDate(+ged[3], month, +ged[1])
  }
  // Bare år: "1934"
  if (/^\d{4}$/.test(dateStr)) return dateStr
  return dateStr  // vis rå tekst som fallback
}
