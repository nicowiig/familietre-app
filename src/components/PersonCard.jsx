import { Link } from 'react-router-dom'
import { formatLifespan, formatDate } from '../lib/dates'
import { getPreferredName, formatName, getSilhouetteType } from '../lib/persons'

function PersonPhoto({ photoUrl, sex, name }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="person-card-photo"
      />
    )
  }
  const type = getSilhouetteType(sex)
  return (
    <div className="person-card-photo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SilhouetteSvg type={type} size={36} />
    </div>
  )
}

function SilhouetteSvg({ type, size = 36 }) {
  const color = '#c8b89a'
  if (type === 'male') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    )
  }
  if (type === 'female') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  )
}

/**
 * Lite personkort, brukt i søkeresultater, lister, o.l.
 * @param {object} props
 * @param {object} props.person       — persons-rad
 * @param {Array}  props.names        — person_names-rader (valgfri)
 * @param {Array}  props.facts        — person_facts-rader (valgfri, for fødsel/død)
 * @param {string} props.photoUrl     — URL til primærbilde (valgfri)
 * @param {string} props.relation     — relasjonstekst (valgfri)
 * @param {string} props.birthYear    — fødselår (shortcut)
 * @param {string} props.deathYear    — dødsår (shortcut)
 * @param {string} props.birthPlace   — fødested (shortcut)
 */
export function PersonCard({
  person,
  names,
  facts,
  photoUrl,
  relation,
  birthYear,
  deathYear,
  birthPlace,
  preferredName,
  onClick,
}) {
  if (!person) return null

  const nameObj  = preferredName || getPreferredName(names) || {}
  const fullName = formatName(nameObj)

  // Hent fødsel/død fra facts om ikke gitt direkte
  let by = birthYear, dy = deathYear, bp = birthPlace
  if (facts && !by && !dy) {
    const birth = facts.find(f => f.fact_type === 'BIRT')
    const death = facts.find(f => f.fact_type === 'DEAT')
    if (birth) { by = birth.date_year; bp = bp || birth.place_city || birth.place_raw }
    if (death) { dy = death.date_year }
  }

  const lifespan = formatLifespan(by, dy, person.is_living)

  const content = (
    <>
      <PersonPhoto photoUrl={photoUrl} sex={person.sex} name={fullName} />
      <div className="person-card-info">
        <div className="person-card-name">{fullName}</div>
        {lifespan && <div className="person-card-years">{lifespan}</div>}
        {bp && <div className="person-card-place">{bp}</div>}
        {relation && <div className="person-card-relation">{relation}</div>}
      </div>
    </>
  )

  if (onClick) {
    return (
      <div className="person-card" onClick={onClick} role="button" tabIndex={0}>
        {content}
      </div>
    )
  }

  return (
    <Link to={`/person/${person.person_id}`} className="person-card">
      {content}
    </Link>
  )
}

export { SilhouetteSvg }
