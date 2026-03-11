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
 * Finn fødselsdato og dødsdato fra en liste med person_facts
 */
export function extractBirthDeath(facts) {
  if (!facts) return { birth: null, death: null, christening: null, burial: null }
  const birth      = facts.find(f => f.fact_type === 'BIRT')
  const death      = facts.find(f => f.fact_type === 'DEAT')
  const christening = facts.find(f => f.fact_type === 'CHR' || f.fact_type === 'BAPM')
  const burial     = facts.find(f => f.fact_type === 'BURI')
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
