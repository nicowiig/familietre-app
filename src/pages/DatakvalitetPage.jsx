import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'

const TABS = [
  { id: 'persons',     label: 'Ufullstendige personer' },
  { id: 'coords',      label: 'Steder uten koordinater' },
  { id: 'unnormalized', label: 'Ikke-normaliserte steder' },
  { id: 'nofamily',   label: 'Mangler familierelasjon' },
  { id: 'duplicates', label: 'Mulige duplikater' },
]

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 99,
        border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        background: active ? 'rgba(192,154,90,0.15)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        fontSize: 'var(--text-sm)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span style={{
        background: active ? 'var(--color-accent)' : 'var(--color-border)',
        color: active ? '#fff' : 'var(--color-text-muted)',
        borderRadius: 99,
        padding: '0 6px',
        fontSize: 11,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  )
}

function TabPersons() {
  const [loading,      setLoading]      = useState(true)
  const [persons,      setPersons]      = useState([])
  const [activeFilter, setActiveFilter] = useState('noBirth')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [
        { data: allPersons },
        { data: birtFacts },
        { data: biographies },
        { data: primaryPhotos },
        { data: addrPeriods },
        { data: allNames },
      ] = await Promise.all([
        supabase.from('persons').select('person_id'),
        supabase.from('person_facts').select('person_id').eq('fact_type', 'BIRT'),
        supabase.from('person_biography').select('person_id'),
        supabase.from('person_photos').select('person_id').eq('is_primary', true),
        supabase.from('address_periods').select('entity_id').eq('entity_type', 'person'),
        supabase.from('person_names').select('person_id, given_name, surname, middle_name').eq('is_preferred', true),
      ])

      const birtSet    = new Set((birtFacts    || []).map(r => r.person_id))
      const bioSet     = new Set((biographies  || []).map(r => r.person_id))
      const photoSet   = new Set((primaryPhotos || []).map(r => r.person_id))
      const addrSet    = new Set((addrPeriods  || []).map(r => r.entity_id))
      const nameMap    = {}
      ;(allNames || []).forEach(n => {
        nameMap[n.person_id] = [n.given_name, n.middle_name, n.surname].filter(Boolean).join(' ')
      })

      const enriched = (allPersons || []).map(p => ({
        id: p.person_id,
        name: nameMap[p.person_id] || p.person_id,
        noBirth:  !birtSet.has(p.person_id),
        noBio:    !bioSet.has(p.person_id),
        noPhoto:  !photoSet.has(p.person_id),
        noAddr:   !addrSet.has(p.person_id),
      }))
      setPersons(enriched)
    } finally {
      setLoading(false)
    }
  }

  const FILTERS = [
    { id: 'noBirth', label: 'Mangler fødselsdato' },
    { id: 'noBio',   label: 'Mangler biografi' },
    { id: 'noPhoto', label: 'Mangler profilbilde' },
    { id: 'noAddr',  label: 'Mangler adresse' },
  ]

  const filtered = persons.filter(p => p[activeFilter])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        {FILTERS.map(f => (
          <FilterChip
            key={f.id}
            label={f.label}
            count={persons.filter(p => p[f.id]).length}
            active={activeFilter === f.id}
            onClick={() => setActiveFilter(f.id)}
          />
        ))}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {filtered.length} person{filtered.length !== 1 ? 'er' : ''} vises
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {filtered.slice(0, 200).map(p => (
          <Link
            key={p.id}
            to={`/person/${p.id}`}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              textDecoration: 'none',
              color: 'var(--color-text)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span>{p.name}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>Se profil →</span>
          </Link>
        ))}
        {filtered.length > 200 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
            Viser de første 200 av {filtered.length} treff.
          </p>
        )}
      </div>
    </div>
  )
}

function TabCoordinates() {
  const [loading,   setLoading]   = useState(true)
  const [addresses, setAddresses] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('addresses')
        .select('id, display_name, building_name, street_name, house_number, house_letter, city, country')
        .is('coordinates_lat', null)
        .order('city')
      setAddresses(data || [])
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {addresses.length} adresse{addresses.length !== 1 ? 'r' : ''} mangler koordinater
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {addresses.map(a => {
          const addrStr = a.display_name
            || [a.building_name, a.street_name, a.house_number, a.house_letter, a.city, a.country].filter(Boolean).join(' ')
          const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addrStr)}`
          return (
            <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 500 }}>{addrStr}</div>
                {a.city && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{a.city}{a.country ? `, ${a.country}` : ''}</div>}
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-accent)',
                  textDecoration: 'underline',
                  textDecorationColor: 'var(--color-border)',
                  textUnderlineOffset: 3,
                  flexShrink: 0,
                }}
              >
                Legg til koordinat →
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabUnnormalized() {
  const [loading,   setLoading]   = useState(true)
  const [facts,     setFacts]     = useState([])
  const [nameMap,   setNameMap]   = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Hent alle RESI/BIRT/DEAT-fakta med place_raw (fri tekst)
      const { data: rawFacts } = await supabase
        .from('person_facts')
        .select('id, person_id, fact_type, place_raw, place_city')
        .in('fact_type', ['RESI', 'BIRT', 'DEAT'])
        .not('place_raw', 'is', null)
        .order('fact_type')

      if (!rawFacts?.length) { setFacts([]); setLoading(false); return }

      // Hent normaliserte adresser for sammenligning
      const { data: normAddrs } = await supabase.from('addresses').select('place_raw').not('place_raw', 'is', null)
      const normSet = new Set((normAddrs || []).map(r => r.place_raw?.trim().toLowerCase()))

      // Filtrer — kun de som IKKE finnes i normalisert adresseregister
      const unnorm = rawFacts.filter(f => {
        const raw = f.place_raw?.trim().toLowerCase()
        return raw && !normSet.has(raw)
      })

      // Hent personnavn
      const personIds = [...new Set(unnorm.map(f => f.person_id))]
      if (personIds.length > 0) {
        const { data: names } = await supabase
          .from('person_names')
          .select('person_id, given_name, surname, middle_name')
          .in('person_id', personIds)
          .eq('is_preferred', true)
        const nm = {}
        ;(names || []).forEach(n => { nm[n.person_id] = [n.given_name, n.middle_name, n.surname].filter(Boolean).join(' ') })
        setNameMap(nm)
      }

      setFacts(unnorm)
    } finally {
      setLoading(false)
    }
  }

  const FACT_LABEL = { RESI: 'Bosted', BIRT: 'Fødested', DEAT: 'Dødssted' }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {facts.length} sted{facts.length !== 1 ? 'er' : ''} registrert som fritekst, ikke koblet til normalisert adresse.
      </p>
      {facts.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Alle steder er normalisert 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {facts.slice(0, 200).map(f => (
            <div key={f.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  <span style={{ color: 'var(--color-text-muted)', marginRight: 8 }}>{FACT_LABEL[f.fact_type] || f.fact_type}:</span>
                  {f.place_raw}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {nameMap[f.person_id] || f.person_id}
                </div>
              </div>
              <Link
                to={`/person/${f.person_id}`}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3, flexShrink: 0 }}
              >
                Se person →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabNoFamily() {
  const [loading,  setLoading]  = useState(true)
  const [isolated, setIsolated] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [
        { data: allPersons },
        { data: families },
        { data: children },
        { data: allNames },
      ] = await Promise.all([
        supabase.from('persons').select('person_id').eq('is_deleted', false),
        supabase.from('families').select('husband_id, wife_id'),
        supabase.from('family_children').select('child_id'),
        supabase.from('person_names').select('person_id, given_name, middle_name, surname').eq('is_preferred', true),
      ])

      const spouseSet = new Set([
        ...(families || []).map(f => f.husband_id).filter(Boolean),
        ...(families || []).map(f => f.wife_id).filter(Boolean),
      ])
      const childSet = new Set((children || []).map(c => c.child_id).filter(Boolean))

      const nameMap = {}
      ;(allNames || []).forEach(n => {
        nameMap[n.person_id] = [n.given_name, n.middle_name, n.surname].filter(Boolean).join(' ')
      })

      const result = (allPersons || [])
        .filter(p => !spouseSet.has(p.person_id) && !childSet.has(p.person_id))
        .map(p => ({ id: p.person_id, name: nameMap[p.person_id] || p.person_id }))
        .sort((a, b) => a.name.localeCompare(b.name, 'nb'))

      setIsolated(result)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {isolated.length} person{isolated.length !== 1 ? 'er' : ''} er ikke koblet til noen familie (verken som ektefelle, forelder eller barn).
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {isolated.slice(0, 200).map(p => (
          <Link
            key={p.id}
            to={`/person/${p.id}`}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              textDecoration: 'none',
              color: 'var(--color-text)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span>{p.name}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>Se profil →</span>
          </Link>
        ))}
        {isolated.length > 200 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
            Viser de første 200 av {isolated.length} treff.
          </p>
        )}
        {isolated.length === 0 && (
          <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Alle personer er koblet til minst én familie 🎉
          </div>
        )}
      </div>
    </div>
  )
}

function normalizeName(str) {
  return (str || '').toLowerCase().trim().replace(/[.\-]/g, '')
}

const DISMISSED_KEY = 'dismissed_duplicate_pairs'

function dismissedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')) }
  catch { return new Set() }
}
function dismissPair(idA, idB) {
  const s = dismissedSet()
  s.add(`${idA}|${idB}`)
  s.add(`${idB}|${idA}`)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]))
}
function isPairDismissed(idA, idB, dismissed) {
  return dismissed.has(`${idA}|${idB}`) || dismissed.has(`${idB}|${idA}`)
}

const CAREER_TYPES = new Set(['occupation', 'position', 'military', 'OCCU', 'TITL', 'title', 'Military Service'])

function MiniProfile({ person, photoUrl }) {
  const lifespan = [
    person.birthYear ? `f. ${person.birthYear}` : null,
    person.deathYear ? `d. ${person.deathYear}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
      {/* Miniatyrbilde */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        overflow: 'hidden', background: 'var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {photoUrl
          ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
              <circle cx="22" cy="17" r="8" fill="var(--color-text-muted)" opacity="0.3" />
              <ellipse cx="22" cy="38" rx="14" ry="9" fill="var(--color-text-muted)" opacity="0.2" />
            </svg>
        }
      </div>
      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <Link
          to={`/person/${person.id}`}
          style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3 }}
        >
          {person.name}
        </Link>
        {lifespan && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{lifespan}</div>
        )}
        {person.occupation && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 1 }}>
            {person.occupation}{person.employer ? ` · ${person.employer}` : ''}
          </div>
        )}
        {person.city && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 1 }}>{person.city}</div>
        )}
      </div>
    </div>
  )
}

function TabDuplicates() {
  const [loading,    setLoading]    = useState(true)
  const [allPairs,   setAllPairs]   = useState([])   // [{a, b}] med beriket data
  const [photoUrls,  setPhotoUrls]  = useState({})   // person_id → signedUrl
  const [dismissed,  setDismissed]  = useState(() => dismissedSet())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [
        { data: allNames },
        { data: allFacts },
      ] = await Promise.all([
        supabase.from('person_names').select('person_id, given_name, surname').eq('is_preferred', true),
        supabase.from('person_facts').select('person_id, fact_type, date_year, place_city').in('fact_type', ['BIRT', 'DEAT']),
      ])

      // Bygg maps for fødsel/død
      const birthMap = {}, deathMap = {}
      ;(allFacts || []).forEach(f => {
        if (f.fact_type === 'BIRT') birthMap[f.person_id] = { year: f.date_year, city: f.place_city }
        if (f.fact_type === 'DEAT') deathMap[f.person_id] = { year: f.date_year }
      })

      // Grupper etter normalisert nøkkel
      const groups = {}
      ;(allNames || []).forEach(n => {
        const key = [normalizeName(n.given_name), normalizeName(n.surname), birthMap[n.person_id]?.year || ''].join('|')
        if (!groups[key]) groups[key] = []
        groups[key].push({ id: n.person_id, name: [n.given_name, n.surname].filter(Boolean).join(' ') })
      })

      // Kun grupper med 2+
      const rawPairs = []
      Object.values(groups).forEach(group => {
        if (group.length < 2) return
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            rawPairs.push([group[i].id, group[j].id, group[i].name, group[j].name])
          }
        }
      })

      if (rawPairs.length === 0) { setAllPairs([]); setLoading(false); return }

      // Hent beriket data for alle involverte person-IDer
      const allIds = [...new Set(rawPairs.flatMap(([a, b]) => [a, b]))]

      const [
        { data: roles },
        { data: addrPeriods },
        { data: photos },
      ] = await Promise.all([
        supabase.from('person_roles')
          .select('person_id, role_type, value, employer')
          .in('person_id', allIds)
          .in('role_type', ['OCCU', 'TITL', 'occupation', 'title', 'position']),
        supabase.from('address_periods')
          .select('entity_id, date_from, addresses(city)')
          .eq('entity_type', 'person')
          .in('entity_id', allIds)
          .order('date_from', { ascending: false }),
        supabase.from('person_photos')
          .select('person_id, drive_url')
          .in('person_id', allIds)
          .eq('is_primary', true),
      ])

      // Bygg oppslags-maps
      const roleMap = {}
      ;(roles || []).forEach(r => {
        if (!roleMap[r.person_id] && r.value) roleMap[r.person_id] = { occupation: r.value, employer: r.employer }
      })

      const cityMap = {}
      ;(addrPeriods || []).forEach(ap => {
        if (!cityMap[ap.entity_id] && ap.addresses?.city) cityMap[ap.entity_id] = ap.addresses.city
      })

      const photoPathMap = {}
      ;(photos || []).forEach(p => { photoPathMap[p.person_id] = p.drive_url })

      // Hent signerte bilde-URLer
      const paths = Object.values(photoPathMap).filter(Boolean)
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from('person-photos').createSignedUrls(paths, 3600)
        const urlMap = {}
        ;(signed || []).forEach(s => { urlMap[s.path] = s.signedUrl })
        const resolved = {}
        Object.entries(photoPathMap).forEach(([pid, path]) => { resolved[pid] = urlMap[path] || null })
        setPhotoUrls(resolved)
      }

      // Bygg endelig par-liste med beriket data
      const enriched = rawPairs.map(([aId, bId, aName, bName]) => ({
        a: {
          id: aId, name: aName,
          birthYear: birthMap[aId]?.year, deathYear: deathMap[aId]?.year,
          occupation: roleMap[aId]?.occupation, employer: roleMap[aId]?.employer,
          city: cityMap[aId],
        },
        b: {
          id: bId, name: bName,
          birthYear: birthMap[bId]?.year, deathYear: deathMap[bId]?.year,
          occupation: roleMap[bId]?.occupation, employer: roleMap[bId]?.employer,
          city: cityMap[bId],
        },
      }))

      setAllPairs(enriched)
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss(idA, idB) {
    dismissPair(idA, idB)
    setDismissed(dismissedSet())
  }

  if (loading) return <LoadingSpinner />

  const visiblePairs = allPairs.filter(({ a, b }) => !isPairDismissed(a.id, b.id, dismissed))
  const dismissedCount = allPairs.length - visiblePairs.length

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {visiblePairs.length} mulige duplikatpar (samme navn + fødselsår).
        {dismissedCount > 0 && <span style={{ marginLeft: 8 }}>· {dismissedCount} avvist og skjult.</span>}
      </p>
      {visiblePairs.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Ingen mulige duplikater å behandle 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {visiblePairs.slice(0, 100).map(({ a, b }) => (
            <div key={`${a.id}|${b.id}`} className="card" style={{ padding: 'var(--space-4)' }}>
              {/* To mini-profiler side om side */}
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <MiniProfile person={a} photoUrl={photoUrls[a.id]} />
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', paddingTop: 12, flexShrink: 0 }}>vs.</div>
                <MiniProfile person={b} photoUrl={photoUrls[b.id]} />
              </div>
              {/* Knapper */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <Link
                  to={`/duplikat/${a.id}/${b.id}`}
                  style={{
                    padding: '4px 12px',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    borderRadius: 5,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Slå sammen →
                </Link>
                <button
                  onClick={() => handleDismiss(a.id, b.id)}
                  style={{
                    padding: '4px 12px',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 5,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Ikke duplikat ✕
                </button>
              </div>
            </div>
          ))}
          {visiblePairs.length > 100 && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
              Viser de første 100 av {visiblePairs.length} par.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function DatakvalitetPage() {
  const [activeTab, setActiveTab] = useState('persons')

  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>

        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
            Datakvalitet
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>
            Finn hull og mangler i slektsarkivet
          </p>
        </div>

        {/* Fane-velger */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                fontWeight: activeTab === t.id ? 600 : 400,
                cursor: 'pointer',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'persons'      && <TabPersons />}
        {activeTab === 'coords'       && <TabCoordinates />}
        {activeTab === 'unnormalized' && <TabUnnormalized />}
        {activeTab === 'nofamily'     && <TabNoFamily />}
        {activeTab === 'duplicates'   && <TabDuplicates />}
      </div>
    </Layout>
  )
}
