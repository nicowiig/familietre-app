import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './LoadingSpinner'
import { Layout } from './Layout'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { status, loading } = useAuth()
  const location = useLocation()

  // Bare vis full spinner mens vi venter på selve sesjonen (veldig kort)
  if (loading) {
    return <LoadingSpinner fullPage text="Laster…" />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/logg-inn" state={{ from: location }} replace />
  }

  if (status === 'needs_request' || status === 'pending' || status === 'rejected') {
    return <Navigate to="/tilgang" replace />
  }

  // Tilgangssjekk pågår — vis innholdet med en liten indikator
  // (unngår lang blokkering ved direkte URL-navigasjon)
  if (status === 'checking_access') {
    return (
      <>
        {children}
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: 'var(--color-bg-nav)', color: 'var(--color-text-nav)',
          padding: '8px 14px', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 9999,
          boxShadow: 'var(--shadow-md)',
        }}>
          <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          Verifiserer tilgang…
        </div>
      </>
    )
  }

  if (requireAdmin && status !== 'admin') {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 'var(--space-16) var(--space-6)', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)' }}>Ingen tilgang</h2>
          <p className="text-muted mt-4">Denne siden er kun for administratorer.</p>
        </div>
      </Layout>
    )
  }

  return children
}

