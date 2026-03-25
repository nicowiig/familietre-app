import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'

const TYPE_LABELS = { feature: 'Ny funksjon', improvement: 'Forbedring', bugfix: 'Feilretting' }
const TYPE_COLORS = {
  feature:     { bg: '#e8f0f8', text: '#1a4a7a' },
  improvement: { bg: '#e8f0e8', text: '#1a4a1a' },
  bugfix:      { bg: '#f8ede8', text: '#7a2a1a' },
}

export function ChangelogPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('changelog_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('id', { ascending: false })
      setEntries(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function fmtDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
  }

  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Hva er nytt?</h1>
          <p className="page-subtitle">Nye funksjoner og forbedringer i familiearkivet.</p>
        </div>

        {loading ? (
          <LoadingSpinner text="Laster…" />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">Ingen entries ennå.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {entries.map(e => {
              const c = TYPE_COLORS[e.entry_type] || TYPE_COLORS.feature
              return (
                <div key={e.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.text, letterSpacing: '0.04em' }}>
                          {TYPE_LABELS[e.entry_type] || e.entry_type}
                        </span>
                        <span className="text-xs text-muted">{fmtDate(e.entry_date)}</span>
                      </div>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
                        {e.title}
                      </h3>
                      <p className="text-sm text-muted">{e.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
