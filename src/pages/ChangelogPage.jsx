import { Layout } from '../components/Layout'

export function ChangelogPage() {
  const ENTRIES = [
    {
      date: 'Mars 2026',
      type: 'feature',
      title: 'Familietre lansert',
      description: '2109 personer og 495 familier importert fra GEDCOM. Søk, profiler, slektsgrener og autentisering via Google.',
    },
  ]

  const TYPE_LABELS = { feature: 'Ny funksjon', improvement: 'Forbedring', bugfix: 'Feilretting' }
  const TYPE_COLORS = {
    feature:     { bg: '#e8f0f8', text: '#1a4a7a' },
    improvement: { bg: '#e8f0e8', text: '#1a4a1a' },
    bugfix:      { bg: '#f8ede8', text: '#7a2a1a' },
  }

  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Hva er nytt?</h1>
          <p className="page-subtitle">Logg over oppdateringer og forbedringer i familietreet.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {ENTRIES.map((e, i) => {
            const c = TYPE_COLORS[e.type] || TYPE_COLORS.feature
            return (
              <div key={i} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.text, letterSpacing: '0.04em' }}>
                        {TYPE_LABELS[e.type]}
                      </span>
                      <span className="text-xs text-muted">{e.date}</span>
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
      </div>
    </Layout>
  )
}
