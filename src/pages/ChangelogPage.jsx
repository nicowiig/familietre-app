import { Layout } from '../components/Layout'

const ENTRIES = [
  {
    date: 'Mars 2026',
    type: 'feature',
    title: 'Arkitektoniske verk',
    description: 'Arkitekter og byggherrer kan nå knyttes til bygninger de har tegnet eller bestilt. Vises med bildekort, kart og lightbox på personprofilen.',
  },
  {
    date: 'Mars 2026',
    type: 'feature',
    title: 'Stedssider',
    description: 'Steder som adresser er koblet til kan ha egne artikler med historikk, bilder og beskrivelse. Klikk "Les mer om…" i adresseblokken på en personprofil.',
  },
  {
    date: 'Mars 2026',
    type: 'feature',
    title: 'Statistikk-side',
    description: 'Ny side med oversikt over fødselssteder, navn, generasjoner og andre mønstre på tvers av hele treet.',
  },
  {
    date: 'Mars 2026',
    type: 'feature',
    title: 'Steder-kart',
    description: 'Alle adresser i arkivet visualisert på ett kart. Klikk på en prikk for å se hvem som bodde der.',
  },
  {
    date: 'Mars 2026',
    type: 'improvement',
    title: 'Karriere og arbeidserfaring slått sammen',
    description: 'Roller og arbeidserfaring vises nå i én felles seksjon per person, med tydeligere tidslinje og varighetsberegning.',
  },
  {
    date: 'Mars 2026',
    type: 'improvement',
    title: 'Adresser: normalisert arkitektur',
    description: 'Alle adresser er nå lagret i et kanonisk register. Samme adresse kobles til flere personer uten duplisering, og historiske adressenavn bevares.',
  },
  {
    date: 'Mars 2026',
    type: 'feature',
    title: 'Familietre-visualisering',
    description: 'Interaktiv trevisning med zoom, etterkommere- og forfedremodus, og støtte for komplekse familiestrukturer.',
  },
  {
    date: 'Mars 2026',
    type: 'feature',
    title: 'Datakvalitet-dashboard',
    description: 'Oversikt over hull i arkivet: hvem mangler biografi, bilde, fødselsdato eller adresse. Sortert og filtrerbart.',
  },
  {
    date: 'Mars 2026',
    type: 'feature',
    title: 'Biografi med media',
    description: 'Personprofiler støtter nå lengre biografier med innebygde bilder og dokumenter direkte i teksten.',
  },
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

export function ChangelogPage() {
  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Hva er nytt?</h1>
          <p className="page-subtitle">Nye funksjoner og forbedringer i familiearkivet.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
