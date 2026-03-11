/**
 * Personnavnformatering og persondata-hjelpere
 */

/**
 * Hent foretrukket navn for en person fra person_names-listen
 */
export function getPreferredName(names) {
  if (!names || names.length === 0) return null
  return names.find(n => n.is_preferred) || names[0]
}

/**
 * Sett sammen fullt navn fra navneobjekt
 */
export function formatName(nameObj) {
  if (!nameObj) return 'Ukjent'
  const parts = []
  if (nameObj.given_name) parts.push(nameObj.given_name)
  if (nameObj.middle_name) parts.push(nameObj.middle_name)
  if (nameObj.surname) parts.push(nameObj.surname)
  if (parts.length === 0 && nameObj.prefix) return nameObj.prefix
  return parts.join(' ') || 'Ukjent'
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
