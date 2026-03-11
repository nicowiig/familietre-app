import { Layout } from '../components/Layout'
import { Link } from 'react-router-dom'

export function TreePage() {
  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-16)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)' }}>Familietre</h1>
        <p className="text-muted mb-8" style={{ fontSize: 'var(--text-md)' }}>
          Interaktiv trevisning — kommer snart.
        </p>
        <span className="ornament">✦ ✦ ✦</span>
        <p className="text-sm text-muted mt-6">
          I mellomtiden kan du se slektskapet fra den einzelne{' '}
          <Link to="/søk" className="text-accent">personsiden</Link>.
        </p>
      </div>
    </Layout>
  )
}
