import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

function isWebView() {
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|Messenger|Twitter|Line\/|MicroMessenger|WebView|wv\b/.test(ua)
    || (ua.includes('iPhone') && !ua.includes('Safari'))
    || (ua.includes('Android') && ua.includes('wv'))
}

export function LoginPage() {
  const { status, loading, signInWithGoogle } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState(null)
  const webView = isWebView()

  if (loading) return <LoadingSpinner fullPage />
  if (status !== 'unauthenticated') return <Navigate to="/" replace />

  async function handleGoogle() {
    setSigningIn(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError('Innloggingen mislyktes. Prøv igjen.')
      setSigningIn(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">Familietre</div>
        <p className="login-tagline">
          Et privat familiearkiv for slekten Wiig og tilknyttede grener
        </p>

        <span className="ornament">✦ ✦ ✦</span>

        {webView && (
          <div style={{
            background: 'rgba(234,179,8,0.12)',
            border: '1px solid rgba(234,179,8,0.4)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
            color: '#ca8a04',
            lineHeight: 1.5,
          }}>
            <strong>Åpne i nettleser for å logge inn</strong><br />
            Google-innlogging fungerer ikke i apper som Messenger eller Instagram.
            Kopier lenken og åpne den i Safari eller Chrome.
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">{error}</div>
        )}

        <button
          className="btn-google"
          onClick={handleGoogle}
          disabled={signingIn || webView}
        >
          {signingIn ? (
            <LoadingSpinner size="sm" />
          ) : (
            <GoogleIcon />
          )}
          {signingIn ? 'Logger inn…' : 'Logg inn med Google'}
        </button>

        <p style={{
          marginTop: 'var(--space-6)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-light)',
          lineHeight: 1.6,
        }}>
          Kun for familiemedlemmer og inviterte. Tilgang krever godkjenning av administrator.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.49-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.53.09-1.04.25-1.52V5.41H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.51.85 3.59l2.68-2.07z"/>
      <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.41L4.5 7.48C5.14 5.59 6.9 3.58 8.98 3.58z"/>
    </svg>
  )
}
