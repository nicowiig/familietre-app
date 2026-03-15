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

function TabDuplicates() {
  const [loading,    setLoading]    = useState(true)
  const [dupePairs,  setDupePairs]  = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [
        { data: allNames },
        { data: birthFacts },
      ] = await Promise.all([
        supabase.from('person_names').select('person_id, given_name, surname').eq('is_preferred', true),
        supabase.from('person_facts').select('person_id, date_year').eq('fact_type', 'BIRT'),
      ])

      const birthMap = {}
      ;(birthFacts || []).forEach(f => { birthMap[f.person_id] = f.date_year })

      // Grupper etter normalisert nøkkel
      const groups = {}
      ;(allNames || []).forEach(n => {
        const key = [normalizeName(n.given_name), normalizeName(n.surname), birthMap[n.person_id] || ''].join('|')
        if (!groups[key]) groups[key] = []
        groups[key].push({ id: n.person_id, name: [n.given_name, n.surname].filter(Boolean).join(' '), year: birthMap[n.person_id] })
      })

      // Kun grupper med 2+ personer
      const pairs = []
      Object.values(groups).forEach(group => {
        if (group.length < 2) return
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            pairs.push([group[i], group[j]])
          }
        }
      })

      setDupePairs(pairs)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        {dupePairs.length} mulige duplikatpar funnet (samme navn + fødselsår).
      </p>
      {dupePairs.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Ingen mulige duplikater funnet 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {dupePairs.slice(0, 100).map(([a, b], i) => (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                <span style={{ fontWeight: 500 }}>{a.name}</span>
                {a.year && <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>f. {a.year}</span>}
                <span style={{ color: 'var(--color-text-muted)', margin: '0 8px' }}>vs.</span>
                <span style={{ fontWeight: 500 }}>{b.name}</span>
                {b.year && <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>f. {b.year}</span>}
              </div>
              <Link
                to={`/duplikat/${a.id}/${b.id}`}
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-accent)',
                  textDecoration: 'underline',
                  textDecorationColor: 'var(--color-border)',
                  textUnderlineOffset: 3,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Slå sammen →
              </Link>
            </div>
          ))}
          {dupePairs.length > 100 && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
              Viser de første 100 av {dupePairs.length} par.
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
