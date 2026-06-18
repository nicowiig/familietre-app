import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Link } from 'react-router-dom'
import { LinkPreview } from '../components/LinkPreview'

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
            { id: 'tilganger',    label: 'Tilganger' },
            { id: 'rettelser',    label: 'Innsendte rettelser' },
            { id: 'datakvalitet', label: 'Datakvalitet' },
            { id: 'hva-er-nytt',  label: 'Hva er nytt?' },
            { id: 'endringslogg', label: 'Endringslogg' },
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

        {tab === 'tilganger'    && <AccessTab />}
        {tab === 'datakvalitet' && <DataQualityTab />}
        {tab === 'hva-er-nytt'  && <ChangelogTab />}
        {tab === 'endringslogg' && <AuditLogTab />}
        {tab === 'rettelser' && (
          <div className="text-muted text-center" style={{ padding: 'var(--space-10)' }}>
            <p>Ingen innsendte rettelser ennå.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

// ─────────────────────────────────────────────────────────────
// Kombinert tilgangs- og koblingsfane
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  pending:  'Venter',
  approved: 'Godkjent',
  rejected: 'Avvist',
}

function AccessTab() {
  const [rows,        setRows]        = useState([])
  const [personNames, setPersonNames] = useState({})
  const [loading,     setLoading]     = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('familietre_tilganger')
      .select('*')
      .order('requested_at', { ascending: false })
    const all = data || []

    const personIds = [...new Set(all.filter(r => r.person_id).map(r => r.person_id))]
    const nameMap = {}
    if (personIds.length) {
      const { data: names } = await supabase
        .from('person_names')
        .select('person_id, given_name, middle_name, surname')
        .in('person_id', personIds)
        .eq('is_preferred', true)
      ;(names || []).forEach(n => {
        nameMap[n.person_id] = [n.given_name, n.middle_name, n.surname].filter(Boolean).join(' ')
      })
    }
    setRows(all)
    setPersonNames(nameMap)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleApprove(id) {
    await supabase
      .from('familietre_tilganger')
      .update({ status: 'approved', handled_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  async function handleReject(id) {
    await supabase
      .from('familietre_tilganger')
      .update({ status: 'rejected', handled_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  async function handleLink(userId, personId) {
    await supabase
      .from('familietre_tilganger')
      .update({ person_id: personId })
      .eq('user_id', userId)
    load()
  }

  async function handleUnlink(id) {
    await supabase
      .from('familietre_tilganger')
      .update({ person_id: null })
      .eq('id', id)
    load()
  }

  if (loading) return <LoadingSpinner text="Laster…" />

  // Sorter: pending → approved+ukoblet → approved+koblet → rejected
  const sorted = [...rows].sort((a, b) => {
    const rank = r => {
      if (r.status === 'pending')                  return 0
      if (r.status === 'approved' && !r.person_id) return 1
      if (r.status === 'approved' && r.person_id)  return 2
      return 3
    }
    return rank(a) - rank(b)
  })

  if (sorted.length === 0) return (
    <p className="text-muted text-center" style={{ padding: 'var(--space-10)' }}>Ingen forespørsler.</p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {sorted.map(r => (
        <AccessCard
          key={r.id}
          row={r}
          linkedPersonName={personNames[r.person_id]}
          onApprove={() => handleApprove(r.id)}
          onReject={() => handleReject(r.id)}
          onLink={personId => handleLink(r.user_id, personId)}
          onUnlink={() => handleUnlink(r.id)}
        />
      ))}
    </div>
  )
}

function AccessCard({ row, linkedPersonName, onApprove, onReject, onLink, onUnlink }) {
  const showLinking = row.status === 'approved'

  return (
    <div className="card">
      {/* ── Øverste rad: navn + status + handlingsknapper ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: showLinking ? 'var(--space-4)' : 0 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{row.display_name || row.email}</div>
          <div className="text-sm text-muted">{row.email}</div>
          {row.message && (
            <p className="text-sm mt-2" style={{ fontStyle: 'italic' }}>«{row.message}»</p>
          )}
          <div className="text-xs text-muted mt-2">
            Sendt: {row.requested_at ? new Date(row.requested_at).toLocaleString('nb-NO') : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end', flexShrink: 0 }}>
          <span className={`badge badge-${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span>
          {row.status === 'pending' && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-primary btn-sm" onClick={onApprove}>Godkjenn</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={onReject}>Avvis</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Koblingsseksjon (kun for godkjente) ── */}
      {showLinking && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
          {row.person_id ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="text-sm text-muted">Koblet til:</span>
                <LinkPreview to={`/person/${row.person_id}`}>
                  {linkedPersonName || row.person_id}
                </LinkPreview>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={onUnlink}>
                Koble fra
              </button>
            </div>
          ) : (
            <PersonLinkSearch user={row} onLink={onLink} />
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Person-søk og forslagsmotor
// ─────────────────────────────────────────────────────────────

function PersonLinkSearch({ user, onLink }) {
  const [suggestions, setSuggestions] = useState(null)
  const [search,      setSearch]      = useState('')
  const [results,     setResults]     = useState([])
  const [saving,      setSaving]      = useState(false)
  const [linkedName,  setLinkedName]  = useState(null)
  const [linkError,   setLinkError]   = useState(null)

  useEffect(() => { loadSuggestions() }, [])

  async function buildSuggestions(nameRows) {
    if (!nameRows.length) return []
    const ids = [...new Set(nameRows.map(r => r.person_id))]
    const [factsRes, rolesRes, personsRes] = await Promise.all([
      supabase.from('person_facts').select('person_id, fact_type, date_year').in('person_id', ids),
      supabase.from('person_roles').select('person_id, value, role_type, date_from, date_to')
        .in('person_id', ids).in('role_type', ['occupation', 'position', 'OCCU', 'TITL', 'title']),
      supabase.from('persons').select('person_id, is_living').in('person_id', ids),
    ])
    const factsMap = {}
    ;(factsRes.data || []).forEach(f => {
      const t = f.fact_type.toUpperCase()
      if (t !== 'BIRT' && t !== 'DEAT') return
      if (!factsMap[f.person_id]) factsMap[f.person_id] = {}
      if (t === 'BIRT') factsMap[f.person_id].birth = f.date_year
      if (t === 'DEAT') factsMap[f.person_id].death = f.date_year
    })
    const rolesMap = {}
    ;(rolesRes.data || []).forEach(r => {
      const dur = (r.date_to || 9999) - (r.date_from || 0)
      if (!rolesMap[r.person_id] || dur > rolesMap[r.person_id].duration)
        rolesMap[r.person_id] = { title: r.value, duration: dur }
    })
    const livingSet = new Set((personsRes.data || []).filter(p => p.is_living).map(p => p.person_id))
    return nameRows.map(r => ({
      ...r,
      birth:    factsMap[r.person_id]?.birth ?? null,
      death:    factsMap[r.person_id]?.death ?? null,
      title:    rolesMap[r.person_id]?.title || null,
      isLiving: livingSet.has(r.person_id),
      hasDeath: factsMap[r.person_id]?.death != null,
    }))
  }

  function scoreAndSort(enriched, scoreMap) {
    return enriched
      .map(r => ({ ...r, finalScore: (scoreMap[r.person_id] || 0) + (r.hasDeath ? -2 : r.isLiving ? 2 : 0) }))
      .sort((a, b) => b.finalScore !== a.finalScore ? b.finalScore - a.finalScore : (b.birth || 0) - (a.birth || 0))
      .slice(0, 6)
  }

  async function loadSuggestions() {
    if (suggestions !== null) return
    const tokens = (user.display_name || user.email.split('@')[0]).split(/[\s._-]+/).filter(t => t.length > 1)
    if (!tokens.length) { setSuggestions([]); return }
    async function fetchToken(t) {
      const { data } = await supabase.from('person_names')
        .select('person_id, given_name, surname, middle_name')
        .or(`given_name.ilike.%${t}%,surname.ilike.%${t}%,middle_name.ilike.%${t}%`)
        .eq('is_preferred', true).limit(50)
      return data || []
    }
    const sets = await Promise.all(tokens.map(fetchToken))
    const allRows = sets.flat()
    const scoreMap = {}
    tokens.forEach((t, ti) => {
      ;(sets[ti] || []).forEach(r => {
        if (!scoreMap[r.person_id]) scoreMap[r.person_id] = 0
        const tl = t.toLowerCase()
        scoreMap[r.person_id] += (r.given_name || '').toLowerCase().includes(tl) ? 2 : 1
      })
    })
    const uniqueRows = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]).slice(0, 30)
      .map(([pid]) => allRows.find(r => r.person_id === pid))
    setSuggestions(scoreAndSort(await buildSuggestions(uniqueRows), scoreMap))
  }

  async function handleSearch(e) {
    const val = e.target.value
    setSearch(val)
    if (val.trim().length < 2) { setResults([]); return }
    const tokens = val.trim().split(/\s+/)
    async function ft(t) {
      const { data } = await supabase.from('person_names')
        .select('person_id, given_name, surname, middle_name')
        .or(`given_name.ilike.%${t}%,surname.ilike.%${t}%,middle_name.ilike.%${t}%`)
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
    setResults(scoreAndSort(await buildSuggestions(matched), scoreMap))
  }

  async function doLink(personId, personName) {
    setSaving(true)
    setLinkError(null)
    try {
      await onLink(personId)
      setLinkedName(personName)
    } catch (err) {
      setLinkError(err.message || 'Koblingen feilet.')
    }
    setSaving(false)
  }

  if (linkedName) return (
    <p className="text-sm" style={{ color: 'var(--color-success, #22c55e)' }}>✓ Koblet til {linkedName}</p>
  )

  const displayList = search.trim().length >= 2 ? results : (suggestions || [])

  return (
    <div>
      <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>Koble til person i slektstreet:</p>
      {linkError && (
        <p className="text-sm" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-2)' }}>⚠ {linkError}</p>
      )}
      <input
        type="search"
        placeholder="Søk etter navn…"
        value={search}
        onChange={handleSearch}
        style={{
          width: '100%', padding: 'var(--space-2) var(--space-3)',
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', color: 'var(--color-text)',
          fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', boxSizing: 'border-box',
        }}
      />
      {suggestions === null && <p className="text-sm text-muted">Laster forslag…</p>}
      {displayList.length === 0 && suggestions !== null && (
        <p className="text-sm text-muted">Ingen treff — prøv å søke.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {displayList.map(s => {
          const fullName = [s.given_name, s.middle_name, s.surname].filter(Boolean).join(' ')
          const lifespan = s.birth ? (s.death ? `${s.birth}–${s.death}` : `f. ${s.birth}`) : null
          return (
            <div key={s.person_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--color-border-light)',
              gap: 'var(--space-3)',
            }}>
              <div>
                <LinkPreview to={`/person/${s.person_id}`}>
                  {fullName}
                </LinkPreview>
                {lifespan && <span className="text-xs text-muted" style={{ marginLeft: 'var(--space-2)' }}>{lifespan}</span>}
                {s.title && <div className="text-xs text-muted">{s.title}</div>}
              </div>
              <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}
                disabled={saving} onClick={() => doLink(s.person_id, fullName)}>
                Koble
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}


/* ===== Datakvalitet ===== */
function DataQualityTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [personsRes, withBioRes, withPhotoRes] = await Promise.all([
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

/* ===== Hva er nytt? (changelog_entries) ===== */

const CL_TYPE_LABELS  = { feature: 'Ny funksjon', improvement: 'Forbedring', bugfix: 'Feilretting' }
const CL_TYPE_COLORS  = {
  feature:     { bg: '#e8f0f8', text: '#1a4a7a' },
  improvement: { bg: '#e8f0e8', text: '#1a4a1a' },
  bugfix:      { bg: '#f8ede8', text: '#7a2a1a' },
}
const BLANK_FORM = { entry_date: new Date().toISOString().slice(0, 10), entry_type: 'feature', title: '', description: '' }

function ChangelogTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState(BLANK_FORM)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('changelog_entries')
      .select('*').order('entry_date', { ascending: false }).order('id', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('changelog_entries').insert({
      entry_date:  form.entry_date,
      entry_type:  form.entry_type,
      title:       form.title.trim(),
      description: form.description.trim(),
    })
    if (err) { setError(err.message); setSaving(false); return }
    setForm(BLANK_FORM)
    setSaving(false)
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Slette denne entryen?')) return
    await supabase.from('changelog_entries').delete().eq('id', id)
    load()
  }

  const inputStyle = {
    width: '100%', padding: 'var(--space-2) var(--space-3)', boxSizing: 'border-box',
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)', color: 'var(--color-text)', fontSize: 'var(--text-sm)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Legg til ny entry */}
      <div className="card">
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>
          Legg til ny entry
        </h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Dato</label>
              <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} style={inputStyle} required />
            </div>
            <div>
              <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Type</label>
              <select value={form.entry_type} onChange={e => setForm(f => ({ ...f, entry_type: e.target.value }))} style={inputStyle}>
                <option value="feature">Ny funksjon</option>
                <option value="improvement">Forbedring</option>
                <option value="bugfix">Feilretting</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Tittel</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="F.eks. «Arkitektoniske verk»" required />
          </div>
          <div>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Beskrivelse</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Hva er nytt og hvorfor er det nyttig?" required />
          </div>
          {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)' }}>{error}</p>}
          <div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Lagrer…' : 'Publiser'}
            </button>
          </div>
        </form>
      </div>

      {/* Eksisterende entries */}
      <div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>
          Publiserte entries
        </h3>
        {loading ? <LoadingSpinner text="Laster…" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {entries.map(e => {
              const c = CL_TYPE_COLORS[e.entry_type] || CL_TYPE_COLORS.feature
              return (
                <div key={e.id} className="card" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.text }}>
                        {CL_TYPE_LABELS[e.entry_type] || e.entry_type}
                      </span>
                      <span className="text-xs text-muted">{new Date(e.entry_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{e.title}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>{e.description}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(e.id)}
                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', padding: '4px 8px' }}
                  >
                    Slett
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Endringslogg (audit log) ===== */

const AUDIT_TABLE_LABELS = {
  persons:                'Person',
  person_names:           'Navn',
  person_facts:           'Hendelse',
  person_biography:       'Biografi',
  person_roles:           'Rolle',
  person_work_experience: 'Arbeidserfaring',
  person_sources:         'Kilde',
  address_periods:        'Adresse',
}
const AUDIT_TYPE_META = {
  insert: { label: 'Lagt til',  bg: '#dcfce7', text: '#166534' },
  update: { label: 'Oppdatert', bg: '#e0f2fe', text: '#0369a1' },
  delete: { label: 'Slettet',   bg: '#fee2e2', text: '#991b1b' },
}
const AUDIT_USER_NAMES = {
  'nicowiig@gmail.com':         'Nicolay Wiig',
  'tallberg.marlene@gmail.com': 'Marlene Tallberg Wiig',
  'njwiig@gmail.com':           'njwiig',
  'sjokoladekake54@gmail.com':  'Gustav Wiig',
  'jontallbe@gmail.com':        'Jon Tallberg',
  'mamsemoren@gmail.com':       'Anne Wiig',
}
function auditDisplayUser(v) {
  if (!v || v === 'script') return 'Nicolay Wiig (script)'
  return AUDIT_USER_NAMES[v] || v
}
function auditFmtRel(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000)
  if (mins < 2)   return 'akkurat nå'
  if (mins < 60)  return `${mins} min siden`
  if (hours < 24) return `${hours} t siden`
  if (days < 7)   return `${days} d siden`
  return new Date(ts).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function auditDayHeader(ts) {
  const d = new Date(ts); d.setHours(0,0,0,0)
  const today = new Date(); today.setHours(0,0,0,0)
  const yest  = new Date(today); yest.setDate(today.getDate() - 1)
  if (d.getTime() === today.getTime()) return 'I dag'
  if (d.getTime() === yest.getTime())  return 'I går'
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const AUDIT_PAGE = 75

function AuditLogTab() {
  const [rows,        setRows]        = useState([])
  const [nameMap,     setNameMap]     = useState({})
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [offset,      setOffset]      = useState(0)
  const [filterType,  setFilterType]  = useState(null)
  const [filterTable, setFilterTable] = useState(null)

  async function fetchNames(ids) {
    if (!ids.length) return {}
    const { data } = await supabase.from('person_names')
      .select('person_id, given_name, surname')
      .in('person_id', ids).eq('is_preferred', true)
    const map = {}
    for (const n of (data || []))
      map[n.person_id] = [n.given_name, n.surname].filter(Boolean).join(' ')
    return map
  }

  async function load(reset = false) {
    const off = reset ? 0 : offset
    if (reset) setLoading(true); else setLoadingMore(true)
    let q = supabase.from('person_audit_log').select('*')
      .order('changed_at', { ascending: false })
      .range(off, off + AUDIT_PAGE - 1)
    if (filterType)  q = q.eq('change_type', filterType)
    if (filterTable) q = q.eq('table_name', filterTable)
    const { data } = await q
    const newRows = data || []
    const ids = [...new Set(newRows.map(r => r.person_id))]
    const names = await fetchNames(ids)
    setNameMap(prev => ({ ...prev, ...names }))
    setRows(prev => reset ? newRows : [...prev, ...newRows])
    setOffset(off + newRows.length)
    setHasMore(newRows.length === AUDIT_PAGE)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => { load(true) }, [filterType, filterTable]) // eslint-disable-line

  function groupByDay(rows) {
    const groups = []
    let cur = null
    for (const row of rows) {
      const day = new Date(row.changed_at).toDateString()
      if (day !== cur) { cur = day; groups.push({ day, ts: row.changed_at, entries: [] }) }
      groups[groups.length - 1].entries.push(row)
    }
    return groups
  }

  const allTables = [...new Set(rows.map(r => r.table_name).filter(Boolean))]
  const groups    = groupByDay(rows)

  if (loading) return <LoadingSpinner text="Laster endringslogg…" />

  return (
    <div>
      {/* Filter-chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        {Object.entries(AUDIT_TYPE_META).map(([type, meta]) => (
          <button key={type} onClick={() => setFilterType(p => p === type ? null : type)} style={{
            fontSize: 'var(--text-xs)', fontWeight: 600, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', border: '1px solid',
            background:  filterType === type ? meta.bg   : 'transparent',
            color:       filterType === type ? meta.text : 'var(--color-text-muted)',
            borderColor: filterType === type ? meta.text : 'var(--color-border)',
          }}>
            {meta.label}
          </button>
        ))}
        {allTables.map(t => (
          <button key={t} onClick={() => setFilterTable(p => p === t ? null : t)} style={{
            fontSize: 'var(--text-xs)', fontWeight: 500, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', border: '1px solid',
            background:  filterTable === t ? 'rgba(192,154,90,0.15)' : 'transparent',
            color:       filterTable === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
            borderColor: filterTable === t ? 'var(--color-accent)' : 'var(--color-border)',
          }}>
            {AUDIT_TABLE_LABELS[t] || t}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Ingen endringer.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {groups.map(group => (
            <div key={group.day}>
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)',
                borderBottom: '1px solid var(--color-border)',
              }}>
                {auditDayHeader(group.ts)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {group.entries.map(row => {
                  const meta   = AUDIT_TYPE_META[row.change_type] || AUDIT_TYPE_META.update
                  const table  = AUDIT_TABLE_LABELS[row.table_name] || row.table_name
                  const name   = nameMap[row.person_id]
                  const detail = [row.field_name, row.old_value && row.new_value ? `«${row.old_value}» → «${row.new_value}»` : (row.new_value ? `«${row.new_value}»` : null), row.note].filter(Boolean).join(' · ')
                  return (
                    <div key={row.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                    }}>
                      <span style={{ flexShrink: 0, fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: meta.bg, color: meta.text, marginTop: 2 }}>
                        {meta.label}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>{auditDisplayUser(row.changed_by)}</span>
                          {name && (
                            <><span style={{ color: 'var(--color-text-muted)' }}> · </span>
                            <LinkPreview to={`/person/${row.person_id}`}>{name}</LinkPreview></>
                          )}
                          {table && <span style={{ color: 'var(--color-text-muted)' }}> · {table}</span>}
                        </div>
                        {detail && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {detail}
                          </div>
                        )}
                      </div>
                      <span style={{ flexShrink: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {auditFmtRel(row.changed_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {hasMore && (
            <button onClick={() => load(false)} disabled={loadingMore} style={{
              alignSelf: 'center', padding: '8px 24px', borderRadius: 99,
              border: '1px solid var(--color-border)', background: 'transparent',
              fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-muted)',
            }}>
              {loadingMore ? 'Laster…' : 'Last flere'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
