/**
 * Personnavnformatering og persondata-hjelpere
 */
import { getDisplayTitle } from './titles'

/**
 * Hent foretrukket navn for en person fra person_names-listen
 */
export function getPreferredName(names) {
  if (!names || names.length === 0) return null
  return names.find(n => n.is_preferred) || names[0]
}

/** Adelspartikler som står foran etternavnet (von Schmettow, af Morgenstierne). */
const PARTICLES = new Set(['von', 'af', 'av', 'de', 'de la', 'du', 'zu', 'von der', 'van', 'van der', 'di', 'da', 'le', 'la'])

/** Prefiks som er en partikkel, normalisert til små bokstaver – ellers null. */
export function surnameParticle(prefix) {
  const p = (prefix || '').trim().toLowerCase()
  return PARTICLES.has(p) ? p : null
}

/**
 * Sett sammen fullt navn fra navneobjekt.
 *
 * - Partikkel i prefix vises foran etternavnet («Carl von Schmettow»),
 *   med mindre etternavnet allerede har den («Munthe af Morgenstierne»).
 * - Høyeste kongelige/fyrstelige/adelige tittel vises foran navnet
 *   («grevinne Amalie Trampe») når personId er kjent. Slå av med { title: false }.
 */
export function formatName(nameObj, { title = true, personId } = {}) {
  if (!nameObj) return 'Ukjent'
  const parts = []
  if (nameObj.given_name) parts.push(nameObj.given_name)
  if (nameObj.middle_name) parts.push(nameObj.middle_name)
  if (nameObj.surname) {
    const particle = surnameParticle(nameObj.prefix)
    const surname = nameObj.surname
    // Etternavn som allerede inneholder en partikkel («Munthe af Morgenstierne») får ikke en til
    const hasParticle = /(^|\s)(von|af|av|de|du|zu|van)(\s|$)/i.test(surname)
    parts.push(particle && !hasParticle ? `${particle} ${surname}` : surname)
  }
  if (parts.length === 0 && nameObj.prefix) return nameObj.prefix
  const name = parts.join(' ') || 'Ukjent'
  if (!title) return name
  const t = getDisplayTitle(personId || nameObj.person_id)
  // Navnet står alltid alene (overskrift, liste, lenke) – stor forbokstav på tittelen
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)} ${name}` : name
}

/**
 * Hent fødselsnavn (name_type = 'birth')
 */
export function getBirthName(names) {
  if (!names) return null
  return names.find(n => n.name_type === 'birth')
}

/**
 * Hent kallenavn
 */
export function getNickname(names) {
  if (!names) return null
  const n = names.find(n => n.nickname)
  return n?.nickname || null
}

/**
 * Hent preferert kjønnet silhuett SVG-path
 */
export function getSilhouetteType(sex) {
  if (sex === 'M') return 'male'
  if (sex === 'F') return 'female'
  return 'unknown'
}

/**
 * Norsk kjønnsbetegnelse
 */
export function genderLabel(sex) {
  if (sex === 'M') return 'Mann'
  if (sex === 'F') return 'Kvinne'
  return 'Ukjent kjønn'
}

/**
 * Formater relasjon fra branch_user_relations eller beregnet sti
 * Enkel fallback som viser lagret tekst
 */
export function formatRelation(relationText) {
  return relationText || null
}
