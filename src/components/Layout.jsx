import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_LINKS = [
  { to: '/',          label: 'Hjem' },
  { to: '/søk',       label: 'Søk' },
  { to: '/grener',    label: 'Slektsgrener' },
  { to: '/tre',       label: 'Familietre' },
  { to: '/hva-er-nytt', label: 'Hva er nytt?' },
]

export function Layout({ children }) {
  const { user, isAdmin, signOut } = useAuth()
  const [navSearch, setNavSearch] = useState('')
  const [menuOpen, setMenuOpen]   = useState(false)
  const navigate = useNavigate()
  const inputRef  = useRef()

  function handleNavSearch(e) {
    e.preventDefault()
    if (navSearch.trim()) {
      navigate(`/søk?q=${encodeURIComponent(navSearch.trim())}`)
      setNavSearch('')
    }
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-brand">Familietre</Link>

          <div className="nav-links">
            {NAV_LINKS.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                {l.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                Admin
              </NavLink>
            )}
          </div>

          <form className="nav-search" onSubmit={handleNavSearch}>
            <span className="nav-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              ref={inputRef}
              type="search"
              placeholder="Søk i treet…"
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              aria-label="Søk"
            />
          </form>

          <div className="nav-user">
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata.full_name || ''}
                className="nav-avatar"
              />
            )}
            <button
              className="btn btn-ghost"
              style={{ color: 'var(--color-text-nav-muted)', fontSize: 'var(--text-sm)' }}
              onClick={signOut}
              title="Logg ut"
            >
              Logg ut
            </button>
          </div>
        </div>
      </nav>

      <main>
        {children}
      </main>

      <footer style={{
        background: 'var(--color-bg-nav)',
        color: 'var(--color-text-nav-muted)',
        padding: 'var(--space-8) var(--space-6)',
        marginTop: 'var(--space-16)',
        textAlign: 'center',
        fontSize: 'var(--text-sm)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{ marginBottom: 'var(--space-2)' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', color: '#e8d9c4' }}>
            Familietre
          </span>
        </p>
        <p>Et privat familiearkiv · Kun for inviterte</p>
      </footer>
    </>
  )
}
