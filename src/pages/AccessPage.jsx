import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function AccessPage() {
  const { status, loading, user, submitAccessRequest, signOut, refreshAccess } = useAuth()
  const [message, setMessage]   = useState('')
  const [submitting, setSubmit] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  if (loading) return <LoadingSpinner fullPage />

  // Viderekoble godkjente brukere
  if (status === 'approved' || status === 'admin') return <Navigate to="/" replace />
  // Ikke innlogget
  if (status === 'unauthenticated') return <Navigate to="/logg-inn" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmit(true)
    setError(null)
    try {
      await submitAccessRequest(message)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Noe gikk galt. Prøv igjen.')
    } finally {
      setSubmit(false)
    }
  }

  return (
    <div className="login-page" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div className="login-card" style={{ textAlign: 'left', maxWidth: 500 }}>
        <div className="login-logo" style={{ textAlign: 'center' }}>Familietre</div>
        <span className="ornament" style={{ marginBottom: 'var(--space-6)' }}>✦ ✦ ✦</span>

        {status === 'pending' ? (
          <PendingView user={user} onSignOut={signOut} onRefresh={refreshAccess} />
        ) : status === 'rejected' ? (
          <RejectedView user={user} onSignOut={signOut} />
        ) : submitted ? (
          <SentView />
        ) : (
          <RequestForm
            user={user}
            message={message}
            setMessage={setMessage}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
            onSignOut={signOut}
          />
        )}
      </div>
    </div>
  )
}

function PendingView({ user, onSignOut, onRefresh }) {
  return (
    <>
      <div className="alert alert-info mb-6">
        <strong>Forespørselen din er mottatt</strong>
        <p style={{ marginTop: 4 }}>
          Din forespørsel venter på godkjenning fra administrator. Du vil se innholdet her
          så snart tilgangen er godkjent.
        </p>
      </div>
      <p className="text-sm text-muted mb-6">
        Innlogget som: <strong>{user?.email}</strong>
      </p>
      <div className="flex gap-3">
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
          Sjekk status
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
          Logg ut
        </button>
      </div>
    </>
  )
}

function RejectedView({ user, onSignOut }) {
  return (
    <>
      <div className="alert alert-warning mb-6">
        <strong>Tilgang ikke godkjent</strong>
        <p style={{ marginTop: 4 }}>
          Din tilgangsforespørsel ble ikke godkjent. Kontakt familieadministrator
          dersom du mener dette er en feil.
        </p>
      </div>
      <p className="text-sm text-muted mb-6">
        Innlogget som: <strong>{user?.email}</strong>
      </p>
      <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
        Logg ut
      </button>
    </>
  )
}

function SentView() {
  return (
    <div className="alert alert-success" style={{ textAlign: 'center' }}>
      <strong>Forespørsel sendt!</strong>
      <p style={{ marginTop: 4 }}>
        Administrator vil behandle forespørselen din. Du vil se innholdet her
        så snart tilgangen er godkjent.
      </p>
    </div>
  )
}

function RequestForm({ user, message, setMessage, onSubmit, submitting, error, onSignOut }) {
  return (
    <>
      <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-3)' }}>
        Be om tilgang
      </h2>
      <p className="text-muted mb-6" style={{ fontSize: 'var(--text-sm)' }}>
        Innlogget som <strong>{user?.email}</strong>.
        Dette er et privat familiearkiv — forklar gjerne hvem du er og din tilknytning
        til familien.
      </p>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="access-message">Melding til administrator (valgfri)</label>
          <textarea
            id="access-message"
            rows={4}
            placeholder="Hvem er du? Hva er din tilknytning til familien?"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? <LoadingSpinner size="sm" /> : null}
            {submitting ? 'Sender…' : 'Send forespørsel'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            Logg ut
          </button>
        </div>
      </form>
    </>
  )
}
