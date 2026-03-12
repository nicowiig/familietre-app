import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { PersonCard } from '../components/PersonCard'
import { formatDate, isToday } from '../lib/dates'
import { formatName } from '../lib/persons'

export function HomePage() {
  const { user, personId } = useAuth()
  const navigate = useNavigate()

  return (
    <Layout>
      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-hero-title">Familietre</h1>
          <p className="home-hero-subtitle">
            Utforsk slektens røtter — fra Bergen til verden
          </p>
        </div>
      </div>

      {/* Innhold */}
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-10)', alignItems: 'start' }}>

          {/* Venstre kolonne */}
          <div>
            <QuickStats />
            <hr className="divider" />
            <DailySection />
            <hr className="divider" />
            <RandomPerson />
          </div>

          {/* Høyre kolonne */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {personId && <MyAncestors personId={personId} />}
            <RecentActivity />
          </div>
        </div>
      </div>
    </Layout>
  )
}

/* ===== Hurtigstatistikk ===== */
function QuickStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function load() {
      const [persons, families] = await Promise.all([
        supabase.from('persons').select('person_id', { count: 'exact', head: true }),
        supabase.from('families').select('family_id', { count: 'exact', head: true }),
      ])
      setStats({
        persons: persons.count || 0,
        families: families.count || 0,
      })
    }
    load()
  }, [])

  if (!stats) return null

  return (
    <div style={{ display: 'flex', gap: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
      <StatItem value={stats.persons.toLocaleString('nb-NO')} label="personer i treet" />
      <StatItem value={stats.families.toLocaleString('nb-NO')} label="familier registrert" />
    </div>
  )
}

function StatItem({ value, label }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

/* ===== Daglige markeringer ===== */
function DailySection() {
  const [birthdays, setBirthdays]   = useState([])
  const [remembered, setRemembered] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date()
      const m = today.getMonth() + 1
      const d = today.getDate()

      // Hent fødselsdager og minnedager
      const { data: facts } = await supabase
        .from('person_facts')
        .select(`
          fact_type, date_month, date_day, date_year, person_id,
          persons!inner(person_id, sex, is_living)
        `)
        .in('fact_type', ['BIRT', 'DEAT'])
        .eq('date_month', m)
        .eq('date_day', d)
        .limit(10)

      if (facts) {
        const bdays  = facts.filter(f => f.fact_type === 'BIRT')
        const deaths = facts.filter(f => f.fact_type === 'DEAT')
        setBirthdays(bdays)
        setRemembered(deaths)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return null
  if (birthdays.length === 0 && remembered.length === 0) return null

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      {birthdays.length > 0 && (
        <DaySection
          title="Dagens bursdagsbarn"
          icon="🎂"
          items={birthdays}
          type="birthday"
        />
      )}
      {remembered.length > 0 && (
        <DaySection
          title="Husket i dag"
          icon="🕯"
          items={remembered}
          type="death"
          style={{ marginTop: birthdays.length > 0 ? 'var(--space-6)' : 0 }}
        />
      )}
    </div>
  )
}

function DaySection({ title, icon, items, type, style }) {
  const [names, setNames] = useState({})

  useEffect(() => {
    async function loadNames() {
      const ids = items.map(f => f.person_id)
      const { data } = await supabase
        .from('person_names')
        .select('person_id, given_name, surname, middle_name, is_preferred, name_type')
        .in('person_id', ids)
      if (data) {
        const map = {}
        data.forEach(n => {
          if (!map[n.person_id] || n.is_preferred) map[n.person_id] = n
        })
        setNames(map)
      }
    }
    loadNames()
  }, [items])

  const today = new Date()

  return (
    <div style={style}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span>{icon}</span> {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map(item => {
          const name = names[item.person_id]
          const fullName = name ? formatName(name) : item.person_id
          const age = item.date_year ? today.getFullYear() - item.date_year : null
          const ageText = age
            ? type === 'birthday'
              ? (item.persons?.is_living ? `fyller ${age} år` : `ville fylt ${age} år`)
              : `ble ${age} år gammel`
            : ''

          return (
            <Link
              key={item.person_id + item.fact_type}
              to={`/person/${item.person_id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                color: 'var(--color-text)',
                padding: 'var(--space-2) 0',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{fullName}</span>
              {ageText && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>— {ageText}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* ===== Tilfeldig familiemedlem ===== */
function RandomPerson() {
  const [person, setPerson]  = useState(null)
  const [names, setNames]    = useState([])
  const [facts, setFacts]    = useState([])
  const [photo, setPhoto]    = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadRandom() {
    setLoading(true)
    try {
      // Hent antall personer og velg en tilfeldig offset
      const { count } = await supabase
        .from('persons')
        .select('person_id', { count: 'exact', head: true })
        .eq('is_deleted', false)

      const offset = Math.floor(Math.random() * (count || 1))

      const { data: [p] } = await supabase
        .from('persons')
        .select('*')
        .eq('is_deleted', false)
        .range(offset, offset)
        .limit(1)

      if (!p) return

      const [namesRes, factsRes, photoRes] = await Promise.all([
        supabase.from('person_names').select('*').eq('person_id', p.person_id),
        supabase.from('person_facts').select('*').eq('person_id', p.person_id).in('fact_type', ['BIRT', 'DEAT']),
        supabase.from('person_photos').select('*').eq('person_id', p.person_id).eq('is_primary', true).limit(1),
      ])

      setPerson(p)
      setNames(namesRes.data || [])
      setFacts(factsRes.data || [])
      setPhoto(photoRes.data?.[0]?.drive_url || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRandom() }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)' }}>
          Tilfeldig familiemedlem
        </h3>
        <button
          className="btn btn-ghost btn-sm"
          onClick={loadRandom}
          disabled={loading}
          title="Vis et annet tilfeldig medlem"
        >
          ↻ Ny
        </button>
      </div>

      {loading ? (
        <div className="loading-center" style={{ padding: 'var(--space-8)' }}>
          <div className="spinner" />
        </div>
      ) : person ? (
        <PersonCard
          person={person}
          names={names}
          facts={facts}
          photoUrl={photo}
        />
      ) : null}
    </div>
  )
}

/* ===== Mine aner ===== */
function MyAncestors({ personId }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    async function load() {
      // Enkel telling — aner tilbake 4 generasjoner
      setInfo({ personId })
    }
    load()
  }, [personId])

  if (!info) return null

  return (
    <div className="card">
      <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-3)' }}>
        Min profil
      </h4>
      <p className="text-sm text-muted mb-4">
        Du er koblet til slektstreet som person <code style={{ fontSize: 'var(--text-xs)', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 3 }}>{personId}</code>.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Link to={`/person/${personId}`} className="btn btn-secondary btn-sm w-full" style={{ justifyContent: 'center' }}>
          Min profil
        </Link>
        <Link to={`/tre?person=${personId}&mode=aner`} className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center' }}>
          Mine aner →
        </Link>
        <Link to={`/tre?person=${personId}&mode=stamfar`} className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center' }}>
          Mine etterkommere →
        </Link>
      </div>
    </div>
  )
}

/* ===== Nylig aktivitet ===== */
function RecentActivity() {
  const [items, setItems] = useState([])
  const [namesMap, setNamesMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('person_biography')
        .select('person_id, last_updated, updated_by, is_ai_generated')
        .order('last_updated', { ascending: false })
        .not('last_updated', 'is', null)
        .limit(8)

      if (data?.length) {
        setItems(data)

        // Én batched query for alle navn — erstatter N individuelle kall
        const ids = data.map(d => d.person_id)
        const { data: nameRows } = await supabase
          .from('person_names')
          .select('person_id, given_name, surname, middle_name, is_preferred')
          .in('person_id', ids)

        if (nameRows) {
          const map = {}
          nameRows.forEach(n => {
            if (!map[n.person_id] || n.is_preferred) map[n.person_id] = n
          })
          const formatted = {}
          Object.entries(map).forEach(([id, n]) => { formatted[id] = formatName(n) })
          setNamesMap(formatted)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="card">
      <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)' }}>
        Siste aktivitet
      </h4>

      {loading ? (
        <div className="loading-center" style={{ padding: 'var(--space-4)' }}>
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Ingen aktivitet ennå.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {items.map(item => (
            <ActivityItem key={item.person_id} item={item} name={namesMap[item.person_id]} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityItem({ item, name }) {
  const date = item.last_updated
    ? new Date(item.last_updated).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
    : ''

  return (
    <Link
      to={`/person/${item.person_id}`}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', textDecoration: 'none', color: 'var(--color-text)', padding: 'var(--space-1) 0' }}
    >
      <div>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          {name || item.person_id}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-2)' }}>
          {item.is_ai_generated ? 'AI-biografi' : 'Biografi oppdatert'}
        </span>
      </div>
      {date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', flexShrink: 0 }}>{date}</span>}
    </Link>
  )
}
