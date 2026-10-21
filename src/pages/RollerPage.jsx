import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { CATEGORY_LABELS, SOCIAL_GROUPS } from '../lib/roles'

/** Oversikt over alle yrker, embeter, titler og grader i treet, gruppert etter stand. */
export function RollerPage() {
  const [roles, setRoles]     = useState([])
  const [counts, setCounts]   = useState({})
  const [query, setQuery]     = useState('')
  const [showEmpty, setShowEmpty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [catRes, prRes, glossRes] = await Promise.all([
        supabase.from('role_catalog').select('id, name, category, social_group, parent_id, period'),
        supabase.from('person_roles').select('role_id, person_id').not('role_id', 'is', null).limit(5000),
        supabase.from('title_glossary').select('original, role_id').not('role_id', 'is', null),
      ])
      const people = {}
      ;(prRes.data || []).forEach(r => { (people[r.role_id] ||= new Set()).add(r.person_id) })
      const c = {}
      Object.entries(people).forEach(([k, v]) => { c[k] = v.size })
      const spell = {}
      ;(glossRes.data || []).forEach(g => { (spell[g.role_id] ||= []).push(g.original) })
      setRoles((catRes.data || []).map(r => ({ ...r, spellings: spell[r.id] || [] })))
      setCounts(c)
      setLoading(false)
    }
    load()
  }, [])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = r => !q
      || r.name.toLowerCase().includes(q)
      || r.spellings.some(s => s.toLowerCase().includes(q))
    const filtered = roles.filter(r => match(r) && (showEmpty || q || counts[r.id]))
    const byGroup = {}
    filtered.forEach(r => { (byGroup[r.social_group || 'Uten gruppe'] ||= []).push(r) })
    const order = [...SOCIAL_GROUPS, 'Uten gruppe']
    return order
      .filter(g => byGroup[g]?.length)
      .map(g => ({
        name: g,
        roles: byGroup[g].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name, 'no')),
        people: byGroup[g].reduce((sum, r) => sum + (counts[r.id] || 0), 0),
      }))
  }, [roles, counts, query, showEmpty])

  if (loading) return <Layout><LoadingSpinner fullPage /></Layout>

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: 960, paddingBottom: 'var(--space-16)' }}>
        <h1 style={{ marginBottom: 'var(--space-2)' }}>Yrker og titler</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', maxWidth: 640, lineHeight: 1.5 }}>
          Alle yrker, embeter, titler og militære grader i familietreet, gruppert etter stand.
          Klikk på en rolle for å se hva den innebar og hvem i treet som hadde den.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
          <input
            type="search"
            placeholder="Søk, også på gamle skrivemåter (f.eks. «sagfører»)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: '1 1 280px', maxWidth: 420 }}
          />
          <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
            Vis også roller uten personer
          </label>
        </div>

        {groups.length === 0 && <p className="text-muted">Ingen treff.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
          {groups.map(g => (
            <section key={g.name} className="profile-section" style={{ margin: 0 }}>
              <h2 className="profile-section-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{g.name}</span>
                <span style={{ fontWeight: 400, fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>{g.people}</span>
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.roles.map(r => (
                  <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--text-sm)' }}>
                    <span>
                      <Link to={`/rolle/${r.id}`}>{r.name}</Link>
                      <span style={{ color: 'var(--color-text-light)', marginLeft: 6, fontSize: 'var(--text-xs)' }}>
                        {CATEGORY_LABELS[r.category]}
                      </span>
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{counts[r.id] || ''}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  )
}
