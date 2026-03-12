import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Link } from 'react-router-dom'

export function AdminPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('tilganger')

  if (!isAdmin) return (
    <Layout>
      <div className="page-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)' }}>Ingen tilgang</h2>
        <p className="text-muted mt-4">Kun for administratorer.</p>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Administrasjon</h1>
        </div>

        {/* Faner */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)', borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
          {[
            { id: 'tilganger',    label: 'Tilgangsforespørsler' },
            { id: 'brukerkobling', label: 'Brukerkobling' },
            { id: 'rettelser',   label: 'Innsendte rettelser' },
            { id: 'datakvalitet', label: 'Datakvalitet' },
          ].map(t => (
            <button
              key={t.id}
              className="btn btn-ghost"
              onClick={() => setTab(t.id)}
              style={{
                borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                borderRadius: 0,
                color: tab === t.id ? 'var(--color-accent)' : undefined,
                fontWeight: tab === t.id ? 600 : undefined,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'tilganger'    && <AccessRequestsTab />}
        {tab === 'brukerkobling' && <UserLinkingTab />}
        {tab === 'datakvalitet' && <DataQualityTab />}
        {tab === 'rettelser' && (
          <div className="text-muted text-center" style={{ padding: 'var(--space-10)' }}>
            <p>Ingen innsendte rettelser ennå.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

function AccessRequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)

  async function load() {
    const { data } = await supabase
      .from('familietre_tilganger')
      .select('*')
      .order('requested_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handle(id, status) {
    await supabase
      .from('familietre_tilganger')
      .update({ status, handled_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  if (loading) return <LoadingSpinner text="Laster forespørsler…" />

  if (requests.length === 0) return (
    <p className="text-muted text-center" style={{ padding: 'var(--space-10)' }}>
      Ingen forespørsler.
    </p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {requests.map(r => (
        <div key={r.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{r.display_name || r.email}</div>
              <div className="text-sm text-muted">{r.email}</div>
              {r.message && <p className="text-sm mt-2" style={{ fontStyle: 'italic' }}>«{r.message}»</p>}
              <div className="text-xs text-muted mt-2">
                Sendt: {r.requested_at ? new Date(r.requested_at).toLocaleString('nb-NO') : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end', flexShrink: 0 }}>
              <span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handle(r.id, 'approved')}
                  >
                    Godkjenn
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-error)' }}
                    onClick={() => handle(r.id, 'rejected')}
                  >
                    Avvis
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const STATUS_LABELS = {
  pending:  'Venter',
  approved: 'Godkjent',
  rejected: 'Avvist',
}

/* ===== Brukerkobling ===== */
function UserLinkingTab() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('familietre_tilganger')
      .select('id, user_id, email, display_name, status, person_id, is_admin')
      .eq('status', 'approved')
      .order('display_name')
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function link(userId, personId) {
    await supabase
      .from('familietre_tilganger')
      .update({ person_id: personId })
      .eq('user_id', userId)
    load()
  }

  async function unlink(userId) {
    await supabase
      .from('familietre_tilganger')
      .update({ person_id: null })
      .eq('user_id', userId)
    load()
  }

  if (loading) return <LoadingSpinner text="Laster brukere…" />

  const linked   = users.filter(u => u.person_id)
  const unlinked = users.filter(u => !u.person_id)

  return (
    <div>
      <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        Koble innloggede brukere til en person i slektstreet. Koblingen gjør at «Min profil»-lenken dukker opp i brukermenyen.
      </p>

      {unlinked.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>
            Ikke koblet ({unlinked.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {unlinked.map(u => (
              <UserLinkCard key={u.user_id} user={u} onLink={pid => link(u.user_id, pid)} />
            ))}
          </div>
        </div>
      )}

      {linked.length > 0 && (
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>
            Koblet ({linked.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {linked.map(u => (
              <div key={u.user_id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.display_name || u.email}</div>
                  <div className="text-sm text-muted">{u.email}</div>
                  <Link to={`/person/${u.person_id}`} className="text-sm" style={{ color: 'var(--color-accent)' }}>
                    → {u.person_id}
                  </Link>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--color-error)', flexShrink: 0 }}
                  onClick={() => unlink(u.user_id)}
                >
                  Koble fra
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {users.length === 0 && (
        <p className="text-muted text-center" style={{ padding: 'var(--space-10)' }}>Ingen godkjente brukere.</p>
      )}
    </div>
  )
}

function UserLinkCard({ user, onLink }) {
  const [suggestions, setSuggestions] = useState(null)
  const [search,      setSearch]      = useState('')
  const [results,     setResults]     = useState([])
  const [saving,      setSaving]      = useState(false)
  const [expanded,    setExpanded]    = useState(false)

  async function buildSuggestions(nameRows) {
    if (!nameRows.length) return []
    const ids = [...new Set(nameRows.map(r => r.person_id))]

    const [factsRes, rolesRes, personsRes] = await Promise.all([
      supabase.from('person_facts').select('person_id, fact_type, date_year')
        .in('person_id', ids).in('fact_type', ['BIRT', 'DEAT']),
      supabase.from('person_roles').select('person_id, value, role_type, date_from, date_to')
        .in('person_id', ids)
        .in('role_type', ['occupation', 'position', 'OCCU', 'TITL', 'title']),
      supabase.from('persons').select('person_id, is_living').in('person_id', ids),
    ])

    const factsMap = {}
    ;(factsRes.data || []).forEach(f => {
      if (!factsMap[f.person_id]) factsMap[f.person_id] = {}
      if (f.fact_type === 'BIRT') factsMap[f.person_id].birth = f.date_year
      if (f.fact_type === 'DEAT') factsMap[f.person_id].death = f.date_year
    })

    const rolesMap = {}
    ;(rolesRes.data || []).forEach(r => {
      const duration = (r.date_to || 9999) - (r.date_from || 0)
      if (!rolesMap[r.person_id] || duration > rolesMap[r.person_id].duration) {
        rolesMap[r.person_id] = { title: r.value, duration }
      }
    })

    const livingSet = new Set(
      (personsRes.data || []).filter(p => p.is_living).map(p => p.person_id)
    )

    return nameRows.map(r => ({
      ...r,
      birth:  factsMap[r.person_id]?.birth  ?? null,
      death:  factsMap[r.person_id]?.death  ?? null,
      title:  rolesMap[r.person_id]?.title  || null,
      isLiving: livingSet.has(r.person_id),
      hasDeath: factsMap[r.person_id]?.death != null,
    }))
  }

  function scoreAndSort(enriched, scoreMap) {
    return enriched
      .map(r => ({
        ...r,
        // Navnescore + livsbonus: +2 levende, -2 avdød (dødsdato registrert)
        finalScore: (scoreMap[r.person_id] || 0) + (r.hasDeath ? -2 : r.isLiving ? 2 : 0),
      }))
      .sort((a, b) => {
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
        return (b.birth || 0) - (a.birth || 0)
      })
      .slice(0, 6)
  }

  async function loadSuggestions() {
    if (suggestions !== null) return
    const tokens = (user.display_name || user.email.split('@')[0])
      .split(/[\s._-]+/).filter(t => t.length > 1)

    if (!tokens.length) { setSuggestions([]); return }

    async function fetchToken(t) {
      const { data } = await supabase
        .from('person_names')
        .select('person_id, given_name, surname, middle_name')
        .or(`given_name.ilike.%${t}%,surname.ilike.%${t}%`)
        .eq('is_preferred', true).limit(50)
      return data || []
    }

    const sets = await Promise.all(tokens.map(fetchToken))
    const allRows = sets.flat()

    const scoreMap = {}
    allRows.forEach(r => {
      if (!scoreMap[r.person_id]) scoreMap[r.person_id] = 0
      scoreMap[r.person_id]++
    })

    // Ta de 30 med høyest navnescore som kandidater
    const uniqueRows = Object.entries(scoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([pid]) => allRows.find(r => r.person_id === pid))

    const enriched = await buildSuggestions(uniqueRows)
    setSuggestions(scoreAndSort(enriched, scoreMap))
    setExpanded(true)
  }

  async function handleSearch(e) {
    const val = e.target.value
    setSearch(val)
    if (val.trim().length < 2) { setResults([]); return }
    const tokens = val.trim().split(/\s+/)
    async function ft(t) {
      const { data } = await supabase
        .from('person_names')
        .select('person_id, given_name, surname, middle_name')
        .or(`given_name.ilike.%${t}%,surname.ilike.%${t}%`)
        .eq('is_preferred', true).limit(30)
      return data || []
    }
    const sets = await Promise.all(tokens.map(ft))
    const idSets = sets.map(rows => new Set(rows.map(r => r.person_id)))
    const matched = sets[0]
      .filter(r => idSets.every(s => s.has(r.person_id)))
      .filter((r, i, arr) => arr.findIndex(x => x.person_id === r.person_id) === i)
      .slice(0, 30)
    const scoreMap = {}
    matched.forEach(r => { scoreMap[r.person_id] = tokens.length })
    const enriched = await buildSuggestions(matched)
    setResults(scoreAndSort(enriched, scoreMap))
  }

  async function doLink(personId) {
    setSaving(true)
    await onLink(personId)
    setSaving(false)
  }

  const displayList = search.trim().length >= 2 ? results : (suggestions || [])

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{user.display_name || user.email}</div>
          <div className="text-sm text-muted">{user.email}</div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={loadSuggestions}
          disabled={expanded}
        >
          {suggestions === null ? 'Finn forslag' : 'Forslag lastet'}
        </button>
      </div>

      {expanded && (
        <div>
          <input
            type="search"
            placeholder="Søk manuelt etter navn i treet…"
            value={search}
            onChange={handleSearch}
            style={{
              width: '100%', padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', color: 'var(--color-text)',
              fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', boxSizing: 'border-box',
            }}
          />

          {displayList.length === 0 && (
            <p className="text-sm text-muted">Ingen treff — prøv å søke manuelt.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {displayList.map(s => {
              const fullName = [s.given_name, s.middle_name, s.surname].filter(Boolean).join(' ')
              const lifespan = s.birth ? (s.death ? `${s.birth}–${s.death}` : `f. ${s.birth}`) : null
              return (
                <div
                  key={s.person_id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--color-border-light)',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <Link to={`/person/${s.person_id}`} target="_blank" style={{ fontWeight: 600, color: 'var(--color-accent)', fontSize: 'var(--text-sm)' }}>
                      {fullName}
                    </Link>
                    {lifespan && <span className="text-xs text-muted" style={{ marginLeft: 'var(--space-2)' }}>{lifespan}</span>}
                    {s.title && <div className="text-xs text-muted">{s.title}</div>}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0 }}
                    disabled={saving}
                    onClick={() => doLink(s.person_id)}
                  >
                    Koble
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function DataQualityTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        personsRes, withBioRes, withPhotoRes
      ] = await Promise.all([
        supabase.from('persons').select('person_id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('person_biography').select('person_id', { count: 'exact', head: true }).eq('is_approved', true),
        supabase.from('person_photos').select('person_id', { count: 'exact', head: true }).eq('is_primary', true),
      ])

      setStats({
        total:     personsRes.count || 0,
        withBio:   withBioRes.count || 0,
        withPhoto: withPhotoRes.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />
  if (!stats) return null

  const bioPct   = Math.round((stats.withBio   / stats.total) * 100)
  const photoPct = Math.round((stats.withPhoto / stats.total) * 100)

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-6)' }}>Datakompletthetsrapport</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-5)' }}>
        <StatCard label="Totalt antall personer" value={stats.total} />
        <StatCard label="Med godkjent biografi" value={stats.withBio} total={stats.total} pct={bioPct} />
        <StatCard label="Med primærbilde" value={stats.withPhoto} total={stats.total} pct={photoPct} />
      </div>
    </div>
  )
}

function StatCard({ label, value, pct }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
        {pct !== undefined ? `${pct}%` : value.toLocaleString('nb-NO')}
      </div>
      <div className="text-sm text-muted mt-2">{label}</div>
      {pct !== undefined && (
        <div style={{ marginTop: 8, background: 'var(--color-border-light)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, background: 'var(--color-accent)', height: '100%', borderRadius: 4 }} />
        </div>
      )}
    </div>
  )
}
