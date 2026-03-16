import { useState, useEffect, useRef } from 'react'
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
import { useFamilyGraph } from '../hooks/useFamilyGraph'
import { findKinship } from '../lib/kinship'

export function PersonPage() {
  const { id } = useParams()
  const { personId: myPersonId } = useAuth()
  const navigate = useNavigate()

  const [person,        setPerson]        = useState(null)
  const [names,         setNames]         = useState([])
  const [facts,         setFacts]         = useState([])
  const [addresses,     setAddresses]     = useState([])
  const [biography,     setBiography]     = useState(null)
  const [roles,         setRoles]         = useState([])
  const [photos,        setPhotos]        = useState([])
  const [sources,       setSources]       = useState([])
  const [families,      setFamilies]      = useState([])
  const [children,      setChildren]      = useState([])
  const [spouseNames,   setSpouseNames]   = useState({}) // family_id → formatted spouse name
  const [childBirths,   setChildBirths]   = useState([]) // [{name, sex, year, month, day, childId}]
  const [loading,       setLoading]       = useState(true)
  const [notFound,      setNotFound]      = useState(false)

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
        supabase.from('address_periods').select('*, addresses(*, place_articles(id, title))').eq('entity_type', 'person').eq('entity_id', personId).order('date_from'),
        supabase.from('person_biography').select('*').eq('person_id', personId).maybeSingle(),
        supabase.from('person_roles').select('*').eq('person_id', personId).order('date_from'),
        supabase.from('person_photos').select('*').eq('person_id', personId).order('photo_order'),
        supabase.from('person_sources').select('*').eq('person_id', personId).order('found_date', { ascending: false }),
      ])

      if (!personRes.data) { setNotFound(true); return }

      setPerson(personRes.data)
      setNames(namesRes.data || [])
      setFacts(factsRes.data || [])
      // Flat struktur: slår sammen address_periods + addresses til én rad per periode
      const flatAddresses = (addrRes.data || []).map(p => ({
        id:           p.id,
        address_type: p.period_type,
        date_from:    p.date_from,
        date_to:      p.date_to,
        is_current:   p.is_current,
        employer:     p.employer,
        department:   p.department,
        notes:        p.notes,
        is_readonly:  p.is_readonly,
        source_type:  p.source_type,
        street_name:  p.addresses?.street_name  || null,
        street_number: p.addresses?.house_number
          ? `${p.addresses.house_number}${p.addresses.house_letter || ''}`
          : null,
        city:         p.addresses?.city         || null,
        postal_code:  p.addresses?.postal_code  || null,
        place_raw:    p.addresses?.place_raw    || null,
        display_name: p.addresses?.display_name || null,
        granularity:  p.addresses?.granularity  || 'unknown',
        building_name: p.addresses?.building_name || null,
        address_id:   p.address_id,
        place_article_id:    p.addresses?.place_articles?.[0]?.id    || null,
        place_article_title: p.addresses?.place_articles?.[0]?.title || null,
      }))
      setAddresses(flatAddresses)
      setBiography(bioRes.data || null)
      setRoles(rolesRes.data || [])
      const rawPhotos = photosRes.data || []
      if (rawPhotos.length > 0) {
        const { data: signed } = await supabase.storage
          .from('person-photos')
          .createSignedUrls(rawPhotos.map(p => p.drive_url), 3600)
        const signedMap = {}
        ;(signed || []).forEach(s => { signedMap[s.path] = s.signedUrl })
        setPhotos(rawPhotos.map(p => ({ ...p, signedUrl: signedMap[p.drive_url] || null })))
      } else {
        setPhotos([])
      }
      setSources(sourcesRes.data || [])

      // Hent familier der personen er ektefelle
      const [famAsSpouse, famAsChild] = await Promise.all([
        supabase.from('families')
          .select('*, family_children(child_id)')
          .or(`husband_id.eq.${personId},wife_id.eq.${personId}`),
        supabase.from('family_children').select('family_id').eq('child_id', personId),
      ])
      const spouseFamilies = famAsSpouse.data || []
      setFamilies(spouseFamilies)

      // Hent ektefellenavn for tidslinjen
      const spouseIdMap = {} // family_id → spouse person_id
      spouseFamilies.forEach(f => {
        const sid = f.husband_id === personId ? f.wife_id : f.husband_id
        if (sid) spouseIdMap[f.family_id] = sid
      })
      const allSpouseIds = Object.values(spouseIdMap).filter(Boolean)

      // Hent alle barne-ID-er fra ektefellesfamilier
      const allChildIds = spouseFamilies.flatMap(f =>
        (f.family_children || []).map(c => c.child_id)
      ).filter(Boolean)

      // Parallell henting: ektefellenavn, barnenavn, barnefødsler, barns kjønn
      const [spouseNamesRes, childNamesRes, childBirthFactsRes, childPersonsRes] = await Promise.all([
        allSpouseIds.length > 0
          ? supabase.from('person_names')
              .select('person_id, given_name, surname, middle_name, is_preferred')
              .in('person_id', allSpouseIds)
          : { data: [] },
        allChildIds.length > 0
          ? supabase.from('person_names')
              .select('person_id, given_name, surname, is_preferred')
              .in('person_id', allChildIds)
          : { data: [] },
        allChildIds.length > 0
          ? supabase.from('person_facts')
              .select('person_id, date_year, date_month, date_day, place_city, place_raw')
              .in('person_id', allChildIds)
              .in('fact_type', ['BIRT', 'BIRTH', 'birth'])
          : { data: [] },
        allChildIds.length > 0
          ? supabase.from('persons')
              .select('person_id, sex')
              .in('person_id', allChildIds)
          : { data: [] },
      ])

      // Bygg spouse names map: family_id → { name, personId }
      const spouseNameById = {}
      ;(spouseNamesRes.data || []).forEach(n => {
        if (!spouseNameById[n.person_id] || n.is_preferred) {
          spouseNameById[n.person_id] = n
        }
      })
      const spouseNamesMap = {}
      Object.entries(spouseIdMap).forEach(([famId, spouseId]) => {
        if (spouseNameById[spouseId]) {
          spouseNamesMap[famId] = { name: formatName(spouseNameById[spouseId]), personId: spouseId }
        }
      })
      setSpouseNames(spouseNamesMap)

      // Bygg barnefødsels-array for tidslinjen
      const childNameById = {}
      ;(childNamesRes.data || []).forEach(n => {
        if (!childNameById[n.person_id] || n.is_preferred) childNameById[n.person_id] = n
      })
      const childBirthByPerson = {}
      ;(childBirthFactsRes.data || []).forEach(f => {
        childBirthByPerson[f.person_id] = f
      })
      const childSexById = {}
      ;(childPersonsRes.data || []).forEach(p => {
        childSexById[p.person_id] = p.sex
      })

      const births = allChildIds.map(childId => {
        const nameRow = childNameById[childId]
        const birthFact = childBirthByPerson[childId]
        return {
          childId,
          name: nameRow ? (nameRow.given_name || '').split(' ')[0] : null, // fornavn
          sex: childSexById[childId] || null,
          year: birthFact?.date_year || null,
          month: birthFact?.date_month || null,
          day: birthFact?.date_day || null,
          place: birthFact?.place_city || birthFact?.place_raw || null,
        }
      }).filter(cb => cb.name || cb.year) // kun med navn eller år
      setChildBirths(births)

      // Hent foreldrefamilier
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

  const preferred   = getPreferredName(names)
  const fullName    = formatName(preferred)
  const birthName   = getBirthName(names)
  const nickname    = preferred?.nickname || getNickname(names)
  const signedName  = names.find(n => n.name_type === 'signed')
  const { birth, death, christening, burial } = extractBirthDeath(facts)
  const primaryPhoto = photos.find(p => p.is_primary) || photos[0]

  const birthYear  = birth?.date_year
  const deathYear  = death?.date_year
  const lifespan   = formatLifespan(birthYear, deathYear, person.is_living)
  const age        = calcAge(birthYear, deathYear)
  const birthDateText = birth ? formatDateText(birth.date_text, birth.date_year, birth.date_month, birth.date_day) : null
  const birthDisplay  = birthDateText || birth?.place_raw || birth?.place_city

  // Roller etter type
  const CAREER_TYPES  = new Set(['occupation', 'position', 'military', 'OCCU', 'TITL', 'Military Service'])
  const EDU_TYPES     = new Set(['education', 'exam'])
  const TITLE_TYPES   = new Set(['title', 'nobility'])

  const careerRoles = roles.filter(r => CAREER_TYPES.has(r.role_type))
  const eduRoles    = roles.filter(r => EDU_TYPES.has(r.role_type))
  const titleRoles  = roles.filter(r => TITLE_TYPES.has(r.role_type))
  const otherRoles  = roles.filter(r =>
    !CAREER_TYPES.has(r.role_type) && !EDU_TYPES.has(r.role_type) && !TITLE_TYPES.has(r.role_type)
  )

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
              personId={id}
              onPhotoUploaded={() => load(id)}
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
            {myPersonId && myPersonId !== id && (
              <RelationBadge personId={id} myPersonId={myPersonId} />
            )}

            <h1 className="profile-name">{fullName}</h1>

            {signedName && (
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
                Kjent som: {formatName(signedName)}
              </p>
            )}

            {nickname && (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                «{nickname}»
              </p>
            )}

            {birthName && formatName(birthName) !== fullName && (
              <p className="profile-birth-name">
                Fødselsnavn: {formatName(birthName)}
              </p>
            )}

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

            <PrimaryOccupation roles={roles} />

            <div className="profile-actions">
              <button className="btn btn-secondary btn-sm">Send rettelse</button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { navigator.clipboard.writeText(window.location.href) }}
              >
                Del profil
              </button>
            </div>
          </div>
        </div>

        {/* Profilinnhold */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-10)', alignItems: 'start' }}>

          {/* Venstre: biografi + fakta + tidslinje + roller + adresser */}
          <div>
            <BiographySection biography={biography} personId={id} />
            <FactsSection
              facts={facts}
              birth={birth}
              death={death}
            />
            <TimelineSection
              facts={facts}
              families={families}
              spouseNamesMap={spouseNames}
              childBirths={childBirths}
              roles={[...careerRoles, ...eduRoles]}
            />
            {careerRoles.length > 0 && <KarriereSection roles={careerRoles} deathYear={deathYear} />}
            {eduRoles.length > 0 && <UtdannelseSection roles={eduRoles} facts={facts} />}
            {titleRoles.length > 0 && <TitlerSection roles={titleRoles} />}
            {otherRoles.length > 0 && <RolesSection roles={otherRoles} title="Andre roller" />}
            <AddressesSection
              addresses={addresses}
              deathYear={deathYear}
            />
            {sources.length > 0 && <SourcesSection sources={sources} />}
            <DigitalarkivetLink name={preferred} birthYear={facts.find(f => normFact(f.fact_type) === 'BIRT')?.date_year} />
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

/* ===== Digitalarkivet-lenke ===== */
function DigitalarkivetLink({ name, birthYear }) {
  if (!name) return null
  const params = new URLSearchParams()
  if (name.given_name) params.set('fornavn', name.given_name)
  if (name.surname)    params.set('etternavn', name.surname)
  if (birthYear)       params.set('foedselsaar', String(birthYear))
  const url = `https://www.digitalarkivet.no/search/persons/advanced?${params.toString()}`
  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Arkivsøk</h2>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-accent)',
          textDecoration: 'underline',
          textDecorationColor: 'var(--color-border)',
          textUnderlineOffset: 3,
        }}
      >
        Søk i Digitalarkivet →
      </a>
    </div>
  )
}

/* ===== Bilder ===== */
async function compressToWebP(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width  * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        blob ? resolve(blob) : reject(new Error('Komprimering feilet'))
      }, 'image/webp', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bildet kunne ikke leses')) }
    img.src = url
  })
}

function PhotoArea({ photos, primaryPhoto, fullName, sex, personId, onPhotoUploaded }) {
  const { isAdmin, isApproved } = useAuth()
  const [lightbox,    setLightbox]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef()

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const blob = await compressToWebP(file)
      const ext  = 'webp'
      const path = `${personId}/${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('person-photos')
        .upload(path, blob, { contentType: 'image/webp', upsert: false })
      if (uploadErr) throw uploadErr

      const isPrimary = photos.length === 0
      const { error: insertErr } = await supabase.from('person_photos').insert({
        person_id:   personId,
        drive_url:   path,
        is_primary:  isPrimary,
        photo_order: photos.length,
      })
      if (insertErr) throw insertErr

      onPhotoUploaded?.()
    } catch (err) {
      setUploadError(err.message || 'Opplasting feilet')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
      {primaryPhoto ? (
        <>
          <img
            src={primaryPhoto.signedUrl}
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
      ) : (
        <div className="profile-photo-placeholder">
          <SilhouetteSvg type={getSilhouetteType(sex)} size={80} />
        </div>
      )}

      {isApproved && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: 'var(--space-1)' }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Laster opp…' : primaryPhoto ? '+ Nytt bilde' : '+ Last opp bilde'}
          </button>
          {uploadError && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', textAlign: 'center' }}>
              {uploadError}
            </p>
          )}
        </>
      )}
    </div>
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
        src={photo.signedUrl}
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
            src={p.signedUrl}
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
const BADGE_STYLES = {
  ancestor:    { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  descendant:  { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  sibling:     { background: '#ede9fe', color: '#4c1d95', border: '1px solid #c4b5fd' },
  collateral:  { background: '#e0f2fe', color: '#0c4a6e', border: '1px solid #7dd3fc' },
}

const TYPE_ICONS = {
  ancestor: '↑',
  descendant: '↓',
  sibling: '↔',
  collateral: '↗',
}

function RelationBadge({ personId, myPersonId }) {
  const { graph, loading } = useFamilyGraph()

  if (loading || !graph) return null

  const k = findKinship(myPersonId, personId, graph.parentMap, graph.sexMap)
  if (!k) return null

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35em',
    fontSize: 'var(--text-sm, 0.85rem)',
    fontWeight: 500,
    padding: '0.2em 0.65em',
    borderRadius: '999px',
    marginBottom: 'var(--space-2, 0.5rem)',
    ...BADGE_STYLES[k.type],
  }

  let suffix = ''
  if (k.type === 'ancestor' && k.genMe >= 5) suffix = ` · ${k.genMe} ledd opp`
  else if (k.type === 'descendant' && k.genThem >= 4) suffix = ` · ${k.genThem} ledd ned`
  else if (k.type === 'collateral') suffix = ` · ${k.genMe + k.genThem} ledd`

  return (
    <div style={style}>
      <span aria-hidden="true">{TYPE_ICONS[k.type]}</span>
      Din {k.label}{suffix}
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
      {expandRoleValue(occ.value)}
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

/* ===== Fakta (nøkkelfakta-rutenett: kun fødsel og død) ===== */

const FACT_TYPE_NORMALIZE = {
  'BIRTH': 'BIRT', 'DEATH': 'DEAT',
  'BAPTISM': 'BAPM', 'CHRISTENING': 'CHR',
  'BURIAL': 'BURI', 'MARRIAGE': 'MARR',
  'DIVORCE': 'DIV', 'CENSUS': 'CENS',
  'RESIDENCE': 'RESI', 'EMIGRATION': 'EMIG',
  'IMMIGRATION': 'IMMI', 'CONFIRMATION': 'CONF',
  'ILLNESS': 'ILLN', 'OCCUPATION': 'OCCU',
  'TITLE': 'TITL', 'PROBATE': 'PROB',
  'NATURALIZATION': 'NATU', 'GRADUATION': 'GRAD',
  'EDUCATION': 'EDUC',
}

function normFact(type) {
  if (!type) return ''
  const upper = type.toUpperCase()
  return FACT_TYPE_NORMALIZE[upper] || upper
}

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
  CONF: 'Konfirmasjon',
  ILLN: 'Sykdom',
  OCCU: 'Yrke',
  TITL: 'Tittel',
}

function FactsSection({ facts, birth, death }) {
  // Kun fødsel og død i nøkkelfakta-rutenettet
  const keyFacts = [birth, death].filter(Boolean)

  if (keyFacts.length === 0) return null

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Fakta og hendelser</h2>
      <div className="facts-table mb-6">
        {keyFacts.map(f => (
          <FactItem key={f.id} fact={f} />
        ))}
      </div>
    </div>
  )
}

function FactItem({ fact }) {
  const label = FACT_LABELS[normFact(fact.fact_type)] || fact.fact_type
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

/* ===== Tidslinje (år-gruppert) ===== */

// Fakta-typer som håndteres andre steder og ikke skal inn i tidslinjen
const TIMELINE_SKIP_TYPES = new Set(['RESI', 'MARR'])

// Roller som er utdanning (brukes i timeline-bygging)
const EDU_ROLE_TYPES = new Set(['education', 'exam'])

// Kildemapping for hendelsestyper
function getFactSource(normType) {
  if (['BIRT', 'DEAT', 'CHR', 'BAPM', 'BURI'].includes(normType)) return 'Kirkebok'
  if (normType === 'CENS') return 'Folketelling'
  return null
}

// Hent år fra families.marr_date
function parseFamilyDateParts(dateStr) {
  if (!dateStr) return { year: null, month: null, day: null }
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] }
  const ged = dateStr.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i)
  if (ged) {
    const ENG_MO = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 }
    return { year: +ged[3], month: ENG_MO[ged[2].toUpperCase()] || null, day: +ged[1] }
  }
  const yearOnly = dateStr.match(/^(\d{4})$/)
  if (yearOnly) return { year: +yearOnly[1], month: null, day: null }
  return { year: null, month: null, day: null }
}

const MÅNEDER_LANG = [
  'januar','februar','mars','april','mai','juni',
  'juli','august','september','oktober','november','desember',
]

function buildTimelineEvents(facts, families, spouseNamesMap, childBirths, roles) {
  const events = []

  // Fra person_facts
  facts.forEach(f => {
    const type = normFact(f.fact_type)
    if (TIMELINE_SKIP_TYPES.has(type)) return

    const place = f.place_city || f.place_raw
    const source = getFactSource(type)

    let label = FACT_LABELS[type] || f.fact_type
    let note = f.notes || null
    let eventPlace = place || null

    // Census: vis som "Registrert i Folketelling" med sted som vanlig place
    if (type === 'CENS') {
      label = 'Registrert i Folketelling'
      // note = kun brukernotater (f.notes), ikke autogenerert tekst
      // eventPlace = sted vises normalt
    }

    events.push({
      year: f.date_year || null,
      month: f.date_month || null,
      day: f.date_day || null,
      label,
      note,
      place: eventPlace,
      source,
    })
  })

  // Fra families: vigsel-hendelser
  families.forEach(fam => {
    if (!fam.marr_date && !fam.marr_place_raw) return
    const { year, month, day } = parseFamilyDateParts(fam.marr_date)
    const spouseInfo = spouseNamesMap?.[fam.family_id]
    const spouseName = spouseInfo?.name
    const label = spouseName ? `Vigsel med ${spouseName}` : 'Vigsel'

    events.push({
      year,
      month,
      day,
      label,
      note: null,
      place: fam.marr_place_raw || null,
      source: 'Vigselbok',
      eventPersonId: spouseInfo?.personId || null,
    })
  })

  // Fra childBirths: barnefødsler
  childBirths.forEach(cb => {
    const childLabel = cb.sex === 'F' ? 'Datter' : cb.sex === 'M' ? 'Sønn' : 'Barn'
    const label = cb.name ? `${childLabel} ${cb.name} født` : `${childLabel} født`

    events.push({
      year: cb.year,
      month: cb.month,
      day: cb.day,
      label,
      note: null,
      place: cb.place || null,
      source: null,
      eventPersonId: cb.childId,
    })
  })

  // Fra roller: karriere og utdanning (ett innslag per rolle ved startår)
  ;(roles || []).forEach(r => {
    if (!r.date_from) return
    const parsed = parseRoleDate(r.date_from)
    if (!parsed?.year) return
    const isEdu = EDU_ROLE_TYPES.has(r.role_type)
    const label = isEdu
      ? (r.place || r.value || 'Utdanning')
      : [r.value, r.place].filter(Boolean).join(' · ')
    events.push({
      year: parsed.year,
      month: parsed.month || null,
      day: null,
      label,
      note: null,
      place: null,
      source: r.source || null,
    })
  })

  return events
}

function sortYearEvents(events) {
  return [...events].sort((a, b) => {
    const am = a.month || 99, bm = b.month || 99
    const ad = a.day || 99, bd = b.day || 99
    if (am !== bm) return am - bm
    return ad - bd
  })
}

function TimelineSection({ facts, families, spouseNamesMap, childBirths, roles }) {
  const events = buildTimelineEvents(facts, families, spouseNamesMap, childBirths, roles)
  if (!events.length) return null

  // Grupper etter år
  const byYear = {}
  const noYear = []
  events.forEach(e => {
    if (e.year) {
      if (!byYear[e.year]) byYear[e.year] = []
      byYear[e.year].push(e)
    } else {
      noYear.push(e)
    }
  })

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Tidslinje</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {years.map(year => (
          <div key={year} style={{ display: 'flex', gap: 'var(--space-4)' }}>
            {/* Årstall */}
            <div style={{
              width: 48,
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.03em',
              paddingTop: 2,
              flexShrink: 0,
            }}>
              {year}
            </div>
            {/* Hendelser dette år */}
            <div style={{
              flex: 1,
              borderLeft: '2px solid var(--color-border)',
              paddingLeft: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}>
              {sortYearEvents(byYear[year]).map((e, i) => (
                <TimelineEventRow key={i} event={e} />
              ))}
            </div>
          </div>
        ))}

        {noYear.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={{
              width: 48,
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-light)',
              letterSpacing: '0.03em',
              paddingTop: 2,
              flexShrink: 0,
            }}>
              ?
            </div>
            <div style={{
              flex: 1,
              borderLeft: '2px solid var(--color-border)',
              paddingLeft: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}>
              {noYear.map((e, i) => <TimelineEventRow key={i} event={e} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineEventRow({ event }) {
  const { month, day, label, note, place, source, eventPersonId } = event

  // Datoprefix: "23. september" eller "september" eller ingenting
  let dateStr = null
  if (day && month) {
    dateStr = `${day}. ${MÅNEDER_LANG[month - 1]}`
  } else if (month) {
    dateStr = MÅNEDER_LANG[month - 1]
  }

  const labelNode = eventPersonId ? (
    <Link
      to={`/person/${eventPersonId}`}
      style={{ fontWeight: 500, color: 'var(--color-text)', textDecoration: 'underline', textDecorationColor: 'var(--color-border)' }}
    >
      {label}
    </Link>
  ) : (
    <span style={{ fontWeight: 500 }}>{label}</span>
  )

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', fontSize: 'var(--text-sm)' }}>
      {/* Dot */}
      <div style={{
        width: 7, height: 7,
        borderRadius: '50%',
        background: 'var(--color-border)',
        marginTop: 5,
        marginLeft: -19,
        flexShrink: 0,
      }} />
      <div>
        {dateStr && (
          <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--space-2)' }}>
            {dateStr} —
          </span>
        )}
        {labelNode}
        {place && (
          <span style={{ color: 'var(--color-text-muted)' }}>
            {' '}·{' '}
            <a href={mapsUrl(place)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
              {place}
            </a>
          </span>
        )}
        {note && (
          <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 1 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Karriere (LinkedIn-stil) ===== */

const ROLE_ABBREV = {
  'h.r.adv':      'høyesterettsadvokat',
  'h.r.adv.':     'høyesterettsadvokat',
  'hr.adv':       'høyesterettsadvokat',
  'h.r.advokat':  'høyesterettsadvokat',
}

function expandRoleValue(value) {
  return ROLE_ABBREV[(value || '').toLowerCase().trim()] || value
}

const MONTH_NAMES_NO = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'des.']

function parseRoleDate(val) {
  if (!val) return null
  const str = String(val)
  const full = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (full) return { year: parseInt(full[1]), month: parseInt(full[2]), day: parseInt(full[3]) }
  const mm = str.match(/^(\d{4})-(\d{2})$/)
  if (mm) return { year: parseInt(mm[1]), month: parseInt(mm[2]) }
  const yy = str.match(/^(\d{4})$/)
  if (yy) return { year: parseInt(yy[1]), month: null }
  return null
}

function formatRoleDate(parsed) {
  if (!parsed) return null
  if (parsed.month) return `${MONTH_NAMES_NO[parsed.month - 1]} ${parsed.year}`
  return String(parsed.year)
}

function formatRolePeriod(from, to, deathYear) {
  if (!from && !to) return null
  const fromParsed = parseRoleDate(from)
  const toParsed = parseRoleDate(to)
  const fromStr = formatRoleDate(fromParsed)
  let toStr
  if (toParsed) {
    toStr = formatRoleDate(toParsed)
  } else if (deathYear) {
    toStr = String(deathYear)
  } else {
    toStr = 'nå'
  }
  if (fromStr) return `${fromStr} – ${toStr}`
  return `frem til ${toStr}`
}

function calcYears(from, to, deathYear) {
  if (!from) return null
  const fromParsed = parseRoleDate(from)
  const toParsed = parseRoleDate(to)
  if (!fromParsed) return null
  const now = new Date()
  const fromMonths = fromParsed.year * 12 + (fromParsed.month || 1)
  let toMonths
  if (toParsed) {
    toMonths = toParsed.year * 12 + (toParsed.month || 12)
  } else if (deathYear) {
    toMonths = deathYear * 12 + 12
  } else {
    toMonths = now.getFullYear() * 12 + (now.getMonth() + 1)
  }
  const totalMonths = toMonths - fromMonths
  if (totalMonths <= 0) return null
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return months === 1 ? '1 mnd' : `${months} mnd`
  if (months === 0) return years === 1 ? '1 år' : `${years} år`
  return `${years} år ${months} mnd`
}

// Sortering: nyeste øverst. Støtter 'YYYY', 'YYYY-MM'
function roleDateSort(a, b) {
  const toNum = v => {
    if (!v) return 0
    const p = parseRoleDate(v)
    if (!p) return 0
    return p.year * 100 + (p.month || 0)
  }
  return toNum(b.date_from) - toNum(a.date_from)
}

// Ikon: koffert (karriere)
function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="12"/>
    </svg>
  )
}

function RoleIcon() {
  return (
    <div style={{
      width: 44, height: 44,
      borderRadius: 'var(--radius)',
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      color: 'var(--color-text-muted)',
    }}>
      <BriefcaseIcon />
    </div>
  )
}

function KarriereSection({ roles, deathYear }) {
  // Grupper etter arbeidsgiver (place), case-insensitivt
  const grouped = {}
  roles.forEach(r => {
    const key = (r.place || '').toLowerCase().trim() || `__noplace_${r.id}`
    if (!grouped[key]) grouped[key] = { place: r.place || null, roles: [] }
    grouped[key].roles.push({ ...r, value: expandRoleValue(r.value) })
  })

  const groups = Object.values(grouped)

  // Sorter grupper: nyeste rolle øverst
  groups.sort((a, b) => {
    const toNum = v => { const p = parseRoleDate(v); return p ? p.year * 100 + (p.month || 0) : 0 }
    const aMax = Math.max(...a.roles.map(r => toNum(r.date_to) || toNum(r.date_from) || 0))
    const bMax = Math.max(...b.roles.map(r => toNum(r.date_to) || toNum(r.date_from) || 0))
    return bMax - aMax
  })

  // Sorter roller innen gruppe: nyeste øverst
  groups.forEach(g => {
    g.roles.sort(roleDateSort)
  })

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Karriere</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {groups.map((g, i) => <KarriereGroup key={i} group={g} deathYear={deathYear} />)}
      </div>
    </div>
  )
}

function KarriereGroup({ group, deathYear }) {
  const { place, roles } = group

  // Dedupliser: slå sammen roller med samme value (etter abbrev-ekspansjon)
  const deduped = {}
  roles.forEach(r => {
    const key = (r.value || '').toLowerCase().trim()
    if (!deduped[key]) {
      deduped[key] = { ...r, _minFrom: r.date_from, _maxTo: r.date_to }
    } else {
      // Ta minste fra-år og største til-år
      if (r.date_from && (!deduped[key]._minFrom || r.date_from < deduped[key]._minFrom)) {
        deduped[key]._minFrom = r.date_from
      }
      if (r.date_to && (!deduped[key]._maxTo || r.date_to > deduped[key]._maxTo)) {
        deduped[key]._maxTo = r.date_to
      }
      // Behold første ikke-tomme reason
      if (!deduped[key].reason && r.reason) deduped[key].reason = r.reason
    }
  })
  const dedupedRoles = Object.values(deduped)
    .map(r => ({ ...r, date_from: r._minFrom, date_to: r._maxTo }))
    .sort(roleDateSort)

  const distinctValues = new Set(dedupedRoles.map(r => (r.value || '').toLowerCase().trim()))
  const hasMultiple = distinctValues.size > 1

  // Vis place-header kun hvis det er 2+ distinkte roller (ikke bare en by)
  const showPlaceHeader = place && hasMultiple

  // Samlet varighet kun for grupper med faktisk felles arbeidsgiver
  const withYears = dedupedRoles.filter(r => r.date_from)
  const minYear = withYears.length ? Math.min(...withYears.map(r => r.date_from)) : null
  const maxYear = withYears.length ? Math.max(...withYears.map(r => r.date_to || deathYear || new Date().getFullYear())) : null
  const totalDuration = hasMultiple ? calcYears(minYear, maxYear, deathYear) : null

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <RoleIcon />
      <div style={{ flex: 1, minWidth: 0 }}>
        {showPlaceHeader && (
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
            {place}
          </div>
        )}
        {showPlaceHeader && totalDuration && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            {totalDuration}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: hasMultiple ? 'var(--space-3)' : 0 }}>
          {dedupedRoles.map((r, i) => (
            <KarriereRoleEntry key={r.id || i} role={r} compact={hasMultiple} deathYear={deathYear} />
          ))}
        </div>
      </div>
    </div>
  )
}

function KarriereRoleEntry({ role, compact, deathYear }) {
  const period = formatRolePeriod(role.date_from, role.date_to, deathYear)
  const duration = calcYears(role.date_from, role.date_to, deathYear)

  return (
    <div style={{ paddingLeft: compact ? 'var(--space-2)' : 0, borderLeft: compact ? '2px solid var(--color-border)' : 'none' }}>
      <div style={{ fontWeight: compact ? 500 : 600, fontSize: 'var(--text-sm)' }}>
        {role.value || '—'}
      </div>
      {(period || duration) && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          {[period, duration].filter(Boolean).join(' · ')}
        </div>
      )}
      {!compact && role.place && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          {role.place}
        </div>
      )}
      {role.reason && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', fontStyle: 'italic' }}>
          {role.reason}
        </div>
      )}
    </div>
  )
}

/* ===== Utdannelse (LinkedIn-stil) ===== */

function GraduationIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  )
}

function EduIcon() {
  return (
    <div style={{
      width: 44, height: 44,
      borderRadius: 'var(--radius)',
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      color: 'var(--color-text-muted)',
    }}>
      <GraduationIcon />
    </div>
  )
}

function UtdannelseSection({ roles, facts }) {
  // Inkluder EDUC/GRAD fra person_facts som ekstra innslag
  const educFacts = (facts || []).filter(f => ['EDUC', 'GRAD'].includes(normFact(f.fact_type)))

  if (!roles.length && !educFacts.length) return null

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Utdannelse</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {[...roles].sort((a, b) => {
          const toNum = v => { const p = parseRoleDate(v); return p ? p.year * 100 + (p.month || 0) : 0 }
          return toNum(b.date_to) - toNum(a.date_to)
        }).map((r, i) => <UtdannelseCard key={r.id || i} role={r} />)}
        {educFacts.map(f => <UtdannelseFactCard key={f.id} fact={f} />)}
      </div>
    </div>
  )
}

function UtdannelseCard({ role }) {
  const period = formatRolePeriod(role.date_from, role.date_to)

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <EduIcon />
      <div style={{ flex: 1, minWidth: 0 }}>
        {role.place && (
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
            {role.place}
          </div>
        )}
        {role.value && (
          <div style={{ fontSize: 'var(--text-sm)', marginBottom: 2 }}>{role.value}</div>
        )}
        {period && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{period}</div>
        )}
        {role.reason && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', fontStyle: 'italic' }}>
            {role.reason}
          </div>
        )}
      </div>
    </div>
  )
}

function UtdannelseFactCard({ fact }) {
  const label = FACT_LABELS[normFact(fact.fact_type)] || fact.fact_type
  const year = fact.date_year
  const place = fact.place_city || fact.place_raw

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <EduIcon />
      <div style={{ flex: 1, minWidth: 0 }}>
        {place && (
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
            {place}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-sm)', marginBottom: 2 }}>{label}</div>
        {year && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{year}</div>
        )}
        {fact.notes && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', fontStyle: 'italic' }}>
            {fact.notes}
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Titler (LinkedIn-stil, med historisk beskrivelse) ===== */

function CrownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 20h20M4 20l2-10 6 4 4-8 4 8 2-10"/>
    </svg>
  )
}

function TitleIcon() {
  return (
    <div style={{
      width: 44, height: 44,
      borderRadius: 'var(--radius)',
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      color: 'var(--color-text-muted)',
    }}>
      <CrownIcon />
    </div>
  )
}

function TitlerSection({ roles }) {
  if (!roles.length) return null

  // Sorter: nyeste øverst
  const sorted = [...roles].sort(roleDateSort)

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Titler og rang</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {sorted.map((r, i) => <TitleCard key={r.id || i} role={r} />)}
      </div>
    </div>
  )
}

function TitleCard({ role }) {
  const period = formatRolePeriod(role.date_from, role.date_to)
  const value = expandRoleValue(role.value)

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <TitleIcon />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
          {value}
        </div>
        {role.place && (
          <div style={{ fontSize: 'var(--text-sm)', marginBottom: 2 }}>{role.place}</div>
        )}
        {period && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{period}</div>
        )}
        {role.reason && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
            {role.reason}
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Andre roller (generisk, for role_types som ikke passer i de spesialiserte seksjonene) ===== */

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

function RolesSection({ roles, title = 'Titler og roller' }) {
  const deduped = Object.values(
    roles.reduce((acc, r) => {
      const rawValue      = r.value || ''
      const expandedValue = expandRoleValue(rawValue)
      const key           = expandedValue.toLowerCase().trim()
      if (!acc[key]) {
        acc[key] = { ...r, value: expandedValue, _periods: [] }
      }
      const period = [r.date_from, r.date_to].filter(Boolean).join(' – ')
      if (period) acc[key]._periods.push(period)
      return acc
    }, {})
  )

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {deduped.map((r, i) => (
          <RoleItem key={r.id || i} role={r} />
        ))}
      </div>
    </div>
  )
}

function RoleItem({ role }) {
  const typeLabel    = ROLE_TYPE_LABELS[role.role_type] || role.role_type || 'Rolle'
  const displayValue = expandRoleValue(role.value)
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

function AddressesSection({ addresses, deathYear }) {
  function addrDateNum(v) {
    if (!v) return 0
    const s = String(v)
    const full = s.match(/^(\d{4})-(\d{2})-\d{2}$/)
    if (full) return parseInt(full[1]) * 100 + parseInt(full[2])
    const mm = s.match(/^(\d{4})-(\d{2})$/)
    if (mm) return parseInt(mm[1]) * 100 + parseInt(mm[2])
    const yy = s.match(/^(\d{4})$/)
    if (yy) return parseInt(yy[1]) * 100
    return 0
  }

  function addrKey(a) {
    if (a.street_name) return `${a.street_name} ${a.street_number || ''}`.trim().toLowerCase()
    if (a.place_raw) return a.place_raw.toLowerCase()
    return null
  }

  // Skjul city/county/country-oppføringer dersom personen har spesifikke adresser
  // som OVERLAPPER tidsmessig — historiske vage adresser som avsluttes før de spesifikke
  // starter, vises likevel (f.eks. Trondheim-oppvekst før Bergen-adresser)
  const VAGUE = new Set(['city', 'county', 'country', 'unknown'])
  const specificAddrs = addresses.filter(a => ['full_address', 'street', 'locality'].includes(a.granularity))
  const hasSpecificAddr = specificAddrs.length > 0
  const earliestSpecificStart = hasSpecificAddr
    ? Math.min(...specificAddrs.map(a => addrDateNum(a.date_from)).filter(Boolean))
    : Infinity

  const filtered = addresses
    .filter(a => {
      if (VAGUE.has(a.granularity) && hasSpecificAddr) {
        // Vis likevel hvis adressen tydelig avsluttes FØR de spesifikke starter
        const thisEnd = addrDateNum(a.date_to)
        if (thisEnd && thisEnd <= earliestSpecificStart) return true
        return false
      }
      if (a.address_type !== 'census_record') return true
      return a.street_name || a.place_raw || a.notes
    })

  const sorted = filtered.sort((a, b) => addrDateNum(a.date_from) - addrDateNum(b.date_from))

  // Kun bostedstyper brukes til å beregne neste adresse i kjeden (ikke workplace etc.)
  const RESIDENTIAL_TYPES = new Set(['residence', 'childhood_home', 'student_housing', 'census_record'])
  const sortedDbOnly = filtered
    .filter(a => RESIDENTIAL_TYPES.has(a.address_type) && (a.street_name || a.place_raw))
    .sort((a, b) => addrDateNum(a.date_from) - addrDateNum(b.date_from))

  // Beregn effective_date_to: neste DB-adresses startår, ellers dødsfallsår (kun for bostedstyper)
  const processed = sorted.map((a) => {
    if (a.date_to) return a
    if (!RESIDENTIAL_TYPES.has(a.address_type)) return { ...a, effective_date_to: null }
    const myNum = addrDateNum(a.date_from)
    const next = sortedDbOnly.find(n =>
      RESIDENTIAL_TYPES.has(n.address_type) && n.date_from && addrDateNum(n.date_from) > myNum
    )
    const effective_date_to = next?.date_from
      ? String(next.date_from).slice(0, 4)
      : deathYear ? String(deathYear) : null
    return { ...a, effective_date_to }
  })

  // Slå sammen påfølgende census-poster på samme adresse
  const deduped = []
  for (const a of processed) {
    const last = deduped[deduped.length - 1]
    if (
      last &&
      a.address_type === 'census_record' &&
      last.address_type === 'census_record' &&
      addrKey(a) &&
      addrKey(a) === addrKey(last)
    ) {
      // Behold første census år som start, bruk siste census år som slutt
      const endFromThis = a.date_from ? String(a.date_from).slice(0, 4) : null
      deduped[deduped.length - 1] = {
        ...last,
        effective_date_to: endFromThis ?? a.date_to ?? last.effective_date_to,
      }
    } else {
      deduped.push(a)
    }
  }

  // Reverser til synkende rekkefølge for visning
  const combined = deduped.reverse()

  if (!combined.length) return null

  return (
    <div className="profile-section">
      <h2 className="profile-section-header">Adresser og bosteder</h2>
      <div className="timeline">
        {combined.map((a, i) => (
          <AddressItem key={a.id || a._id || i} addr={a} deathYear={deathYear} />
        ))}
      </div>
    </div>
  )
}

function formatAddrDate(val) {
  if (!val) return null
  const s = String(val)
  const full = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (full) return `${parseInt(full[3])}. ${MONTH_NAMES_NO[parseInt(full[2]) - 1]} ${full[1]}`
  const mm = s.match(/^(\d{4})-(\d{2})$/)
  if (mm) return `${MONTH_NAMES_NO[parseInt(mm[2]) - 1]} ${mm[1]}`
  return s
}

function AddressItem({ addr, deathYear }) {
  const typeLabel = ADDR_TYPE_LABELS[addr.address_type] || addr.address_type || 'Bosted'
  const dateTo = addr.date_to ?? addr.effective_date_to
  const duration  = calcYears(addr.date_from, dateTo, deathYear)
  const periodParts = [formatAddrDate(addr.date_from), formatAddrDate(dateTo)].filter(Boolean).join(' – ')
  const period    = duration ? `${periodParts} · ${duration}` : periodParts
  const streetPart = addr.street_name ? `${addr.street_name} ${addr.street_number || ''}`.trim() : null
  const postalPart = [addr.postal_code, addr.city].filter(Boolean).join(' ')
  const display   = streetPart
    ? [streetPart, postalPart].filter(Boolean).join(', ')
    : addr.place_raw || (addr.address_type === 'census_record' ? addr.notes : null)
  const noteText = addr.notes || (streetPart && addr.place_raw ? addr.place_raw : null)

  return (
    <div className="timeline-item">
      {period && <div className="timeline-date">{period}</div>}
      {display && (
        <div className="timeline-title">
          <a
            href={mapsUrl(display)}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--color-accent)', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3 }}
          >
            {display}
          </a>
        </div>
      )}
      {addr.building_name && (
        <div className="timeline-place" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
          {addr.building_name}
        </div>
      )}
      <div className="timeline-place" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{typeLabel}</div>
      {addr.employer && (
        <div className="timeline-place">{addr.employer}{addr.department ? ` · ${addr.department}` : ''}</div>
      )}
      {noteText && (
        <div className="timeline-place" style={{ fontStyle: 'italic', color: 'var(--color-text-light)' }}>
          {noteText}
        </div>
      )}
      {addr.place_article_id && (
        <Link
          to={`/place/${addr.place_article_id}`}
          style={{ fontSize: 'var(--text-xs)', color: '#b45309', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3 }}
        >
          Les mer om {addr.place_article_title} →
        </Link>
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
      {parentFamilies.length > 0 && (
        <div className="card">
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>Foreldre</h4>
          {parentFamilies.map(fam => (
            <ParentFamilyCard key={fam.family_id} family={fam} personId={person.person_id} />
          ))}
        </div>
      )}

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
