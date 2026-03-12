import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { SilhouetteSvg } from '../components/PersonCard'
import { useAuth } from '../contexts/AuthContext'
import {
  formatDate, formatDateText, formatLifespan, calcAge, mapsUrl, extractBirthDeath, parseFamilyDate,
} from '../lib/dates'
import {
  getPreferredName, formatName, getBirthName, getNickname, getSilhouetteType,
} from '../lib/persons'

export function PersonPage() {
  const { id } = useParams()
  const { personId: myPersonId } = useAuth()
  const navigate = useNavigate()

  const [person,    setPerson]    = useState(null)
  const [names,     setNames]     = useState([])
  const [facts,     setFacts]     = useState([])
  const [addresses, setAddresses] = useState([])
  const [biography, setBiography] = useState(null)
  const [roles,     setRoles]     = useState([])
  const [photos,    setPhotos]    = useState([])
  const [sources,   setSources]   = useState([])
  const [families,  setFamilies]  = useState([]) // familier der denne er ektefelle
  const [children,  setChildren]  = useState([]) // familier der denne er barn
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)

  useEffect(() => {
    if (id) load(id)
  }, [id])

  async function load(personId) {
    setLoading(true)
    setNotFound(false)
    try {
      const [
        personRes, namesRes, factsRes, addrRes, bioRes, rolesRes, photosRes, sourcesRes,
      ] = await Promise.all([
        supabase.from('persons').select('*').eq('person_id', personId).eq('is_deleted', false).maybeSingle(),
        supabase.from('person_names').select('*').eq('person_id', personId).order('is_preferred', { ascending: false }),
        supabase.from('person_facts').select('*').eq('person_id', personId).order('date_year'),
        supabase.from('person_addresses').select('*').eq('person_id', personId).order('date_from'),
        supabase.from('person_biography').select('*').eq('person_id', personId).maybeSingle(),
        supabase.from('person_roles').select('*').eq('person_id', personId).order('date_from'),
        supabase.from('person_photos').select('*').eq('person_id', personId).order('photo_order'),
        supabase.from('person_sources').select('*').eq('person_id', personId).order('found_date', { ascending: false }),
      ])

      if (!personRes.data) { setNotFound(true); return }

      setPerson(personRes.data)
      setNames(namesRes.data || [])
      setFacts(factsRes.data || [])
      setAddresses(addrRes.data || [])
      setBiography(bioRes.data || null)
      setRoles(rolesRes.data || [])
      setPhotos(photosRes.data || [])
      setSources(sourcesRes.data || [])

      // Hent familier
      const [famAsSpouse, famAsChild] = await Promise.all([
        supabase.from('families')
          .select('*, family_children(child_id)')
          .or(`husband_id.eq.${personId},wife_id.eq.${personId}`),
        supabase.from('family_children').select('family_id').eq('child_id', personId),
      ])
      setFamilies(famAsSpouse.data || [])

      if (famAsChild.data?.length) {
        const famIds = famAsChild.data.map(f => f.family_id)
        const { data: parentFams } = await supabase
          .from('families')
          .select('*, family_children(child_id)')
          .in('family_id', famIds)
        setChildren(parentFams || [])
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Layout><LoadingSpinner fullPage text="Laster profil…" /></Layout>

  if (notFound) return (
    <Layout>
      <div className="page-container" style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)' }}>Person ikke funnet</h2>
        <p className="text-muted mt-4">Person-ID: {id}</p>
        <Link to="/" className="btn btn-secondary mt-6">Tilbake til forsiden</Link>
      </div>
    </Layout>
  )

  const preferred  = getPreferredName(names)
  const fullName   = formatName(preferred)
  const birthName  = getBirthName(names)
  const nickname   = preferred?.nickname || getNickname(names)
  const { birth, death, christening, burial } = extractBirthDeath(facts)
  const primaryPhoto = photos.find(p => p.is_primary) || photos[0]

  const birthYear  = birth?.date_year
  const deathYear  = death?.date_year
  const lifespan   = formatLifespan(birthYear, deathYear, person.is_living)
  const age        = calcAge(birthYear, deathYear)
  const birthDateText = birth ? formatDateText(birth.date_text, birth.date_year, birth.date_month, birth.date_day) : null
  const birthDisplay  = birthDateText || birth?.place_raw || birth?.place_city

  return (
    <Layout>
      <div className="page-container" style={{ paddingBottom: 'var(--space-16)' }}>

        {/* Profil-header */}
        <div className="profile-hero">
          {/* Bilde */}
          <div className="profile-photo-area">
            <PhotoArea
              photos={photos}
              primaryPhoto={primaryPhoto}
              fullName={fullName}
              sex={person.sex}
            />
            <Link
              to={`/tre?person=${id}&mode=aner`}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'center' }}
            >
              Vis i familietre
            </Link>
          </div>

          {/* Info */}
          <div className="profile-info">
            {/* Relasjon til innlogget bruker */}
            {myPersonId && myPersonId !== id && (
              <RelationBadge personId={id} myPersonId={myPersonId} />
            )}

            <h1 className="profile-name">{fullName}</h1>

            {/* Kallenavn */}
            {nickname && (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                «{nickname}»
              </p>
            )}

            {/* Fødselsnavn */}
            {birthName && formatName(birthName) !== fullName && (
              <p className="profile-birth-name">
                Fødselsnavn: {formatName(birthName)}
              </p>
            )}

            {/* Datoer */}
            <div className="profile-dates">
              {birth && birthDisplay && (
                <span>
                  f.{' '}
                  {birth.place_raw
                    ? <a href={mapsUrl(birth.place_raw)} target="_blank" rel="noreferrer">
                        {birthDateText}
                        {birth.place_city && ` · ${birth.place_city}`}
                      </a>
                    : birthDateText
                  }
                </span>
              )}
              {birth && death && <span className="sep">–</span>}
              {death && (
                <span>
                  d.{' '}
                  {death.place_raw
                    ? <a href={mapsUrl(death.place_raw)} target="_blank" rel="noreferrer">
                        {formatDateText(death.date_text, death.date_year, death.date_month, death.date_day)}
                        {death.place_city && ` · ${death.place_city}`}
                      </a>
                    : formatDateText(death.date_text, death.date_year, death.date_month, death.date_day)
                  }
                </span>
              )}
              {age && !person.is_living && (
                <span className="text-light text-sm">({age} år)</span>
              )}
            </div>

            {/* Primært yrke fra roller */}
            <PrimaryOccupation roles={roles} />

            {/* Handlinger */}
            <div className="profile-actions">
              <button className="btn btn-secondary btn-sm">Send rettelse</button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                }}
              >
                Del profil
              </button>
            </div>
          </div>
        </div>

        {/* Profilinnhold */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-10)', alignItems: 'start' }}>

          {/* Venstre: biografi + fakta + roller + adresser */}
          <div>
            <BiographySection biography={biography} personId={id} />
            <FactsSection
              facts={facts}
              birth={birth}
              death={death}
              christening={christening}
              burial={burial}
              families={families}
            />
            {roles.length > 0 && <RolesSection roles={roles} />}
            {addresses.length > 0 && <AddressesSection addresses={addresses} />}
            {sources.length > 0 && <SourcesSection sources={sources} />}
          </div>

          {/* Høyre: familie */}
          <div>
            <FamilySection
              person={person}
              families={families}
              parentFamilies={children}
            />
            {photos.length > 1 && <PhotosSection photos={photos} fullName={fullName} />}
          </div>
        </div>
      </div>
    </Layout>
  )
}

/* ===== Bilder ===== */
function PhotoArea({ photos, primaryPhoto, fullName, sex }) {
  const [lightbox, setLightbox] = useState(false)

  if (!primaryPhoto) {
    return (
      <div className="profile-photo-placeholder">
        <SilhouetteSvg type={getSilhouetteType(sex)} size={80} />
      </div>
    )
  }

  return (
    <>
      <img
        src={primaryPhoto.drive_url}
        alt={fullName}
        className="profile-photo"
        onClick={() => setLightbox(true)}
        style={{ cursor: 'zoom-in' }}
      />
      {lightbox && (
        <Lightbox
          photos={photos}
          initial={0}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  )
}

function Lightbox({ photos, initial, onClose }) {
  const [idx, setIdx] = useState(initial)
  const photo = photos[idx]

  function prev() { setIdx(i => (i > 0 ? i - 1 : photos.length - 1)) }
  function next() { setIdx(i => (i < photos.length - 1 ? i + 1 : 0)) }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <button
        onClick={e => { e.stopPropagation(); prev() }}
        style={{ position: 'absolute', left: 24, color: '#fff', background: 'none', border: 'none', fontSize: 32, cursor: 'pointer' }}
      >‹</button>
      <img
        src={photo.drive_url}
        alt=""
        style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }}
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={e => { e.stopPropagation(); next() }}
        style={{ position: 'absolute', right: 24, color: '#fff', background: 'none', border: 'none', fontSize: 32, cursor: 'pointer' }}
      >›</button>
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 24, right: 24, color: '#fff', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
      >✕</button>
    </div>
  )
}

function PhotosSection({ photos, fullName }) {
  const [lightbox, setLightbox] = useState(null)

  return (
    <div className="profile-section mt-6">
      <h3 className="profile-section-header">Bilder</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {photos.map((p, i) => (
          <img
            key={p.id}
            src={p.drive_url}
            alt={fullName}
            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', objectPosition: 'center 20%', borderRadius: 'var(--radius)', cursor: 'zoom-in', filter: 'sepia(30%) contrast(1.05)' }}
            onClick={() => setLightbox(i)}
          />
        ))}
      </div>
      {lightbox !== null && (
        <Lightbox photos={photos} initial={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

/* ===== Relasjonsmerke ===== */
function RelationBadge({ personId, myPersonId }) {
  const [relation, setRelation] = useState(null)

  useEffect(() => {
    // Hent lagret relasjon om finnes
    async function load() {
      const { data } = await supabase
        .from('branch_user_relations')
        .select('relation_text, path_description')
        .eq('user_person_id', myPersonId)
        .limit(1)
      // Bruk person_id som filter her er ikke helt riktig for branch_user_relations,
      // men vi lagrer relasjon mot personprofilen fra GraphQL
      // TODO: implementer full BFS-relasjon
    }
  }, [personId, myPersonId])

  if (!relation) return null

  return (
    <div className="profile-relation-badge">
      <span>⟳</span>
      {relation}
    </div>
  )
}

/* ===== Primæryrke ===== */
const LOW_PRIORITY_OCC = ['advokatfullmektig', 'dommerfullmektig', 'fullmektig']

function PrimaryOccupation({ roles }) {
  const occRoles = roles.filter(r =>
    ['OCCU', 'TITL', 'occupation', 'title', 'position'].includes(r.role_type) && r.value
  )
  if (!occRoles.length) return null

  const scored = occRoles.map(r => ({
    ...r,
    duration: (r.date_to || 9999) - (r.date_from || 0),
    isLow: LOW_PRIORITY_OCC.some(l => r.value?.toLowerCase().includes(l)),
  }))
  scored.sort((a, b) => a.isLow - b.isLow || b.duration - a.duration)
  const occ = scored[0]

  return (
    <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
      {occ.value}
      {occ.place && ` · ${occ.place}`}
    </p>
  )
}

/* ===== Biografi ===== */
const TAG_RE = /<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi

function renderBiographyParagraph(text, paraKey) {
  const parts = []
  let lastIndex = 0
  let match
  TAG_RE.lastIndex = 0
  while ((match = TAG_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const href = match[1]
    const label = match[2]
    if (href.startsWith('/')) {
      parts.push(<Link key={match.index} to={href}>{label}</Link>)
    } else {
      parts.push(<a key={match.index} href={href} target="_blank" rel="noreferrer">{label}</a>)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return <p key={paraKey}>{parts}</p>
}

function BiographySection({ biography, personId }) {
  const [expanded, setExpanded] = useState(false)
  const text = biography?.biography_text

  if (!text) return null

  const isLong = text.length > 600
  const displayText = isLong && !expanded ? text.slice(0, 600) + '…' : text

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Biografi</h2>
      <div className="profile-biography">
        {displayText.split('\n\n').map((para, i) => renderBiographyParagraph(para, i))}
      </div>
      {isLong && (
        <button
          className="btn btn-ghost btn-sm mt-4"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? 'Vis mindre' : 'Les mer'}
        </button>
      )}
      {biography?.is_ai_generated && !biography?.is_approved && (
        <p className="text-xs text-muted mt-3" style={{ fontStyle: 'italic' }}>
          AI-forslag — ikke verifisert av administrator
        </p>
      )}
    </div>
  )
}

/* ===== Fakta ===== */
const FACT_LABELS = {
  BIRT: 'Fødsel',
  DEAT: 'Død',
  CHR:  'Dåp',
  BAPM: 'Dåp',
  BURI: 'Gravferd',
  MARR: 'Vigsel',
  DIV:  'Skilsmisse',
  EMIG: 'Emigrasjon',
  IMMI: 'Immigrasjon',
  RESI: 'Bosted',
  EDUC: 'Utdannelse',
  GRAD: 'Eksamen',
  CENS: 'Folketelling',
  NATU: 'Statsborgerskap',
  RETI: 'Pensjonering',
  PROB: 'Testament',
  WILL: 'Testament',
}

function FactsSection({ facts, birth, death, christening, burial, families }) {
  // Vis viktige fakta i faktarutenett, resten i tidslinje
  const keyFacts = [birth, death, christening, burial].filter(Boolean)
  const otherFacts = facts.filter(f =>
    !['BIRT', 'DEAT', 'CHR', 'BAPM', 'BURI', 'CENS'].includes(f.fact_type)
  )

  // Vigsel fra familie
  const marriages = families.filter(f => f.marr_date || f.marr_place_raw)

  if (keyFacts.length === 0 && otherFacts.length === 0 && marriages.length === 0) return null

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Fakta og hendelser</h2>

      {keyFacts.length > 0 && (
        <div className="facts-table mb-6">
          {keyFacts.map(f => (
            <FactItem key={f.id} fact={f} />
          ))}
          {marriages.map(m => (
            <div key={m.family_id} className="fact-item">
              <span className="fact-label">Vigsel</span>
              <span className="fact-value">
                {parseFamilyDate(m.marr_date)}
                {m.marr_place_raw && (
                  <a href={mapsUrl(m.marr_place_raw)} target="_blank" rel="noreferrer">
                    {' '}· {m.marr_place_raw}
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {otherFacts.length > 0 && (
        <div className="timeline">
          {otherFacts.map(f => (
            <TimelineItem key={f.id} fact={f} />
          ))}
        </div>
      )}
    </div>
  )
}

function FactItem({ fact }) {
  const label = FACT_LABELS[fact.fact_type] || fact.fact_type
  const date  = formatDateText(fact.date_text, fact.date_year, fact.date_month, fact.date_day)
  const place = fact.place_city || fact.place_raw

  return (
    <div className="fact-item">
      <span className="fact-label">{label}</span>
      <span className="fact-value">
        {date}
        {date && place && ' · '}
        {place && (
          <a href={mapsUrl(place)} target="_blank" rel="noreferrer">{place}</a>
        )}
        {fact.notes && (
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>
            {fact.notes}
          </span>
        )}
      </span>
    </div>
  )
}

function TimelineItem({ fact }) {
  const label = FACT_LABELS[fact.fact_type] || fact.fact_type
  const date  = formatDateText(fact.date_text, fact.date_year, fact.date_month, fact.date_day) ||
                (fact.date_year ? String(fact.date_year) : null)
  const place = fact.place_city || fact.place_raw

  return (
    <div className="timeline-item">
      {date && <div className="timeline-date">{date}</div>}
      <div className="timeline-title">{label}</div>
      {place && (
        <div className="timeline-place">
          <a href={mapsUrl(place)} target="_blank" rel="noreferrer">{place}</a>
        </div>
      )}
      {fact.notes && (
        <div className="timeline-place" style={{ fontStyle: 'italic', marginTop: 2 }}>
          {fact.notes}
        </div>
      )}
    </div>
  )
}

/* ===== Roller ===== */
const ROLE_TYPE_LABELS = {
  OCCU:               'Yrke',
  TITL:               'Tittel',
  occupation:         'Yrke',
  title:              'Tittel',
  military:           'Militær rang',
  'Military Service': 'Militærtjeneste',
  education:          'Utdannelse',
  exam:               'Eksamen',
  position:           'Stilling',
  membership:         'Medlemskap',
  nobility:           'Rang/adel',
  Publication:        'Utgivelse',
  publication:        'Utgivelse',
}

function RolesSection({ roles }) {
  // Grupper roller med samme verdi (case-insensitive) og slå sammen perioder
  const deduped = Object.values(
    roles.reduce((acc, r) => {
      const key = (r.value || '').toLowerCase().trim()
      if (!acc[key]) {
        acc[key] = { ...r, _periods: [] }
      }
      const period = [r.date_from, r.date_to].filter(Boolean).join(' – ')
      if (period) acc[key]._periods.push(period)
      return acc
    }, {})
  )

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Titler og roller</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {deduped.map((r, i) => (
          <RoleItem key={r.id || i} role={r} />
        ))}
      </div>
    </div>
  )
}

const ROLE_ABBREV = {
  'h.r.adv':      'høyesterettsadvokat',
  'hr.adv':       'høyesterettsadvokat',
  'h.r.advokat':  'høyesterettsadvokat',
}

function RoleItem({ role }) {
  const typeLabel    = ROLE_TYPE_LABELS[role.role_type] || role.role_type || 'Rolle'
  const rawValue     = role.value || ''
  const displayValue = ROLE_ABBREV[rawValue.toLowerCase().trim()] || rawValue
  const periods      = role._periods?.length > 0
    ? role._periods.join(', ')
    : [role.date_from, role.date_to].filter(Boolean).join(' – ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 'var(--text-base)' }}>{displayValue}</strong>
        <span className="text-xs text-muted">{typeLabel}</span>
        {periods && <span className="text-xs text-light">{periods}</span>}
      </div>
      {role.place && (
        <span className="text-sm text-muted">{role.place}</span>
      )}
      {role.reason && (
        <span className="text-sm" style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>{role.reason}</span>
      )}
    </div>
  )
}

/* ===== Adresser ===== */
const ADDR_TYPE_LABELS = {
  residence:       'Bosted',
  childhood_home:  'Barndomshjem',
  student_housing: 'Studentbolig',
  workplace:       'Arbeidsplass',
  summer_home:     'Sommerhus',
  census_record:   'Folketelling',
  other:           'Annet',
  RESI:            'Bosted',
}

function AddressesSection({ addresses }) {
  const displayAddresses = addresses.filter(a =>
    a.address_type !== 'census_record' ||
    a.street_name || a.place_raw
  )
  if (!displayAddresses.length) return null

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Adresser og bosteder</h2>
      <div className="timeline">
        {displayAddresses.map((a, i) => (
          <AddressItem key={a.id || i} addr={a} />
        ))}
      </div>
    </div>
  )
}

function AddressItem({ addr }) {
  const typeLabel = ADDR_TYPE_LABELS[addr.address_type] || addr.address_type || 'Bosted'
  const period    = [addr.date_from, addr.date_to].filter(Boolean).join(' – ')
  const display   = addr.street_name
    ? [addr.street_name, addr.street_number, addr.postal_code, addr.city].filter(Boolean).join(' ')
    : addr.place_raw

  return (
    <div className="timeline-item">
      {period && <div className="timeline-date">{period}</div>}
      <div className="timeline-title">{typeLabel}</div>
      {display && (
        <div className="timeline-place">
          <a href={mapsUrl(display)} target="_blank" rel="noreferrer">{display}</a>
        </div>
      )}
      {addr.employer && (
        <div className="timeline-place">{addr.employer}{addr.department ? ` · ${addr.department}` : ''}</div>
      )}
    </div>
  )
}

/* ===== Kilder ===== */
function SourcesSection({ sources }) {
  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Kilder</h2>
      <div className="sources-list">
        {sources.map((s, i) => (
          <SourceItem key={s.id || i} source={s} />
        ))}
      </div>
    </div>
  )
}

function SourceItem({ source }) {
  return (
    <div className="source-item">
      <div className="source-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
      </div>
      <div>
        <div className="source-title">
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a>
          ) : (
            source.title || 'Kilde uten tittel'
          )}
        </div>
        <div className="source-meta">
          {source.archive && <span>{source.archive}</span>}
          {source.archive && source.record_type && <span> · </span>}
          {source.record_type && <span>{source.record_type}</span>}
          {source.found_date && <span> · Funnet: {source.found_date}</span>}
        </div>
        {source.notes && (
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            {source.notes}
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Familie ===== */
function FamilySection({ person, families, parentFamilies }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Foreldre */}
      {parentFamilies.length > 0 && (
        <div className="card">
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>Foreldre</h4>
          {parentFamilies.map(fam => (
            <ParentFamilyCard key={fam.family_id} family={fam} personId={person.person_id} />
          ))}
        </div>
      )}

      {/* Ektefelle og barn */}
      {families.map(fam => (
        <SpouseFamilyCard
          key={fam.family_id}
          family={fam}
          personId={person.person_id}
          sex={person.sex}
        />
      ))}
    </div>
  )
}

function ParentFamilyCard({ family, personId }) {
  const [fatherName, setFatherName] = useState(null)
  const [motherName, setMotherName] = useState(null)
  const [siblings,   setSiblings]   = useState([])

  useEffect(() => {
    async function load() {
      const ids = [family.husband_id, family.wife_id].filter(Boolean)
      if (!ids.length) return
      const { data } = await supabase
        .from('person_names')
        .select('person_id, given_name, surname, middle_name, is_preferred')
        .in('person_id', ids)
      if (data) {
        const byId = {}
        data.forEach(n => {
          if (!byId[n.person_id] || n.is_preferred) byId[n.person_id] = n
        })
        if (family.husband_id) setFatherName(byId[family.husband_id])
        if (family.wife_id) setMotherName(byId[family.wife_id])
      }

      // Hent søsken
      const siblingIds = (family.family_children || [])
        .map(c => c.child_id)
        .filter(id => id !== personId)

      if (siblingIds.length > 0) {
        const { data: sibNames } = await supabase
          .from('person_names')
          .select('person_id, given_name, surname, middle_name, is_preferred')
          .in('person_id', siblingIds)
        if (sibNames) {
          const sibById = {}
          sibNames.forEach(n => {
            if (!sibById[n.person_id] || n.is_preferred) sibById[n.person_id] = n
          })
          setSiblings(siblingIds.map(id => ({ id, name: sibById[id] })))
        }
      }
    }
    load()
  }, [family, personId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {family.husband_id && (
        <RelativeLink id={family.husband_id} name={fatherName} label="Far" />
      )}
      {family.wife_id && (
        <RelativeLink id={family.wife_id} name={motherName} label="Mor" />
      )}
      {siblings.length > 0 && (
        <>
          <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Søsken</div>
          {siblings.map(s => (
            <RelativeLink key={s.id} id={s.id} name={s.name} />
          ))}
        </>
      )}
    </div>
  )
}

function SpouseFamilyCard({ family, personId, sex }) {
  const spouseId   = sex === 'M' ? family.wife_id : family.husband_id
  const [spouseName, setSpouseName] = useState(null)
  const [childNames, setChildNames] = useState({})
  const children   = family.family_children || []

  useEffect(() => {
    async function load() {
      const ids = [spouseId, ...children.map(c => c.child_id)].filter(Boolean)
      if (!ids.length) return
      const { data } = await supabase
        .from('person_names')
        .select('person_id, given_name, surname, middle_name, is_preferred')
        .in('person_id', ids)
      if (data) {
        const byId = {}
        data.forEach(n => {
          if (!byId[n.person_id] || n.is_preferred) byId[n.person_id] = n
        })
        if (spouseId) setSpouseName(byId[spouseId])
        const cm = {}
        children.forEach(c => { cm[c.child_id] = byId[c.child_id] })
        setChildNames(cm)
      }
    }
    load()
  }, [family, spouseId])

  return (
    <div className="card">
      <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>
        {sex === 'M' ? 'Hustru' : 'Ektemann'}
      </h4>
      {spouseId ? (
        <RelativeLink id={spouseId} name={spouseName} />
      ) : (
        <p className="text-sm text-muted">Ukjent ektefelle</p>
      )}

      {family.marr_date && (
        <p className="text-sm text-muted mt-2">
          Gift: {parseFamilyDate(family.marr_date)}
          {family.marr_place_raw && ` · ${family.marr_place_raw}`}
        </p>
      )}

      {children.length > 0 && (
        <>
          <hr className="divider" style={{ margin: 'var(--space-4) 0' }} />
          <h5 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Barn
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {children.map(c => (
              <RelativeLink
                key={c.child_id}
                id={c.child_id}
                name={childNames[c.child_id]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RelativeLink({ id, name, label }) {
  const displayName = name ? formatName(name) : id

  return (
    <Link
      to={`/person/${id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        color: 'var(--color-text)',
        textDecoration: 'none',
        fontSize: 'var(--text-sm)',
        padding: '3px 0',
      }}
    >
      {label && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', width: 28, flexShrink: 0, fontWeight: 600 }}>{label}</span>
      )}
      <span style={{ fontWeight: 600 }}>{displayName}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-border)" strokeWidth="2" style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </Link>
  )
}
