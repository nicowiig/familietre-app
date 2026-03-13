import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'

const NAV_LINKS = [
  { to: '/',          label: 'Hjem' },
  { to: '/grener',    label: 'Slektsgrener' },
  { to: '/tre',       label: 'Familietre' },
  { to: '/hva-er-nytt', label: 'Hva er nytt?' },
]

export function Layout({ children }) {
  const { user, isAdmin, signOut, personId: myPersonId } = useAuth()
  const [navSearch, setNavSearch]       = useState('')
  const [menuOpen,  setMenuOpen]        = useState(false)
  const [userOpen,  setUserOpen]        = useState(false)
  const [suggestions, setSuggestions]   = useState([])
  const [sugOpen,   setSugOpen]         = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const navigate      = useNavigate()
  const inputRef      = useRef()
  const userRef       = useRef()
  const suggestRef    = useRef()
  const debounceRef   = useRef()

  // Hent antall ventende tilgangsforespørsler (kun for admins)
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('familietre_tilganger')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count || 0))
  }, [isAdmin])

  // Lukk avatar-dropdown ved klikk utenfor
  useEffect(() => {
    function onClickOutside(e) {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Lukk søkeforslag ved klikk utenfor
  useEffect(() => {
    function onClickOutside(e) {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setSugOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleNavSearch(e) {
    e.preventDefault()
    if (navSearch.trim()) {
      navigate(`/søk?q=${encodeURIComponent(navSearch.trim())}`)
      setNavSearch('')
      setSugOpen(false)
      setSuggestions([])
    }
  }

  function handleNavSearchInput(e) {
    const val = e.target.value
    setNavSearch(val)
    clearTimeout(debounceRef.current)

    if (val.trim().length < 2) {
      setSuggestions([])
      setSugOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const tokens = val.trim().split(/\s+/).filter(Boolean)
      if (tokens.length === 0) { setSuggestions([]); setSugOpen(false); return }

      // For hvert token, søk i alle navnefelt
      async function fetchToken(token) {
        const { data } = await supabase
          .from('person_names')
          .select('person_id, given_name, surname, middle_name')
          .or(`given_name.ilike.%${token}%,surname.ilike.%${token}%,middle_name.ilike.%${token}%`)
          .eq('is_preferred', true)
          .limit(50)
        return data || []
      }

      const tokenResults = await Promise.all(tokens.map(fetchToken))
      const idSets = tokenResults.map(rows => new Set(rows.map(r => r.person_id)))
      const matched = tokenResults[0].filter(r => idSets.every(s => s.has(r.person_id)))

      // Dedupliser og begrens til 6
      const seen = new Set()
      const unique = matched.filter(r => {
        if (seen.has(r.person_id)) return false
        seen.add(r.person_id)
        return true
      }).slice(0, 6)

      if (unique.length) {
        // Hent fødsel og dødsdato for de matchede personene
        const ids = unique.map(r => r.person_id)
        const { data: facts } = await supabase
          .from('person_facts')
          .select('person_id, fact_type, date_year')
          .in('person_id', ids)
          .in('fact_type', ['BIRT', 'DEAT'])

        const factsMap = {}
        ;(facts || []).forEach(f => {
          if (!factsMap[f.person_id]) factsMap[f.person_id] = {}
          if (f.fact_type === 'BIRT') factsMap[f.person_id].birth = f.date_year
          if (f.fact_type === 'DEAT') factsMap[f.person_id].death = f.date_year
        })

        setSuggestions(unique.map(r => ({ ...r, ...factsMap[r.person_id] })))
        setSugOpen(true)
      } else {
        setSuggestions([])
        setSugOpen(false)
      }
    }, 200)
  }

  function handleNavSearchKey(e) {
    if (e.key === 'Escape') {
      setSugOpen(false)
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

          {/* Søkefelt med live-forslag */}
          <div ref={suggestRef} style={{ position: 'relative' }}>
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
                onChange={handleNavSearchInput}
                onKeyDown={handleNavSearchKey}
                aria-label="Søk"
                autoComplete="off"
              />
            </form>
            {sugOpen && suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                zIndex: 200,
                overflow: 'hidden',
                marginTop: 4,
                minWidth: 280,
              }}>
                {suggestions.map(s => {
                  const lifespan = s.birth
                    ? s.death ? `${s.birth}–${s.death}` : `f. ${s.birth}`
                    : null
                  return (
                    <Link
                      key={s.person_id}
                      to={`/person/${s.person_id}`}
                      onClick={() => { setSugOpen(false); setNavSearch('') }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-3) var(--space-4)',
                        color: 'var(--color-text)',
                        textDecoration: 'none',
                        fontSize: 'var(--text-sm)',
                        borderBottom: '1px solid var(--color-border-light)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{[s.given_name, s.middle_name, s.surname].filter(Boolean).join(' ')}</span>
                      {lifespan && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 'var(--space-3)' }}>{lifespan}</span>}
                    </Link>
                  )
                })}
                <Link
                  to={`/søk?q=${encodeURIComponent(navSearch.trim())}`}
                  onClick={() => { setSugOpen(false); setNavSearch('') }}
                  style={{
                    display: 'block',
                    padding: 'var(--space-2) var(--space-4)',
                    color: 'var(--color-accent)',
                    textDecoration: 'none',
                    fontSize: 'var(--text-xs)',
                    textAlign: 'center',
                    borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-bg-elevated)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Se alle resultater →
                </Link>
              </div>
            )}
          </div>

          {/* Avatar-dropdown */}
          <div ref={userRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', position: 'relative' }}
              onClick={() => setUserOpen(o => !o)}
              aria-label="Brukermeny"
            >
              {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                <img
                  src={user.user_metadata.avatar_url || user.user_metadata.picture}
                  alt={user.user_metadata.full_name || ''}
                  className="nav-avatar"
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <div className="nav-avatar" style={{
                  background: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-sm)', color: '#fff', fontWeight: 600,
                }}>
                  {user?.user_metadata?.full_name?.[0] || '?'}
                </div>
              )}
              {pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  background: '#ef4444', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, pointerEvents: 'none',
                }}>
                  {pendingCount}
                </span>
              )}
            </button>

            {userOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: 'var(--color-bg-nav)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                minWidth: 160,
                zIndex: 200,
                overflow: 'hidden',
              }}>
                {myPersonId && (
                  <Link
                    to={`/person/${myPersonId}`}
                    onClick={() => setUserOpen(false)}
                    style={{
                      display: 'block',
                      padding: 'var(--space-3) var(--space-4)',
                      color: 'var(--color-text-nav-muted)',
                      textDecoration: 'none',
                      fontSize: 'var(--text-sm)',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-nav-muted)'}
                  >
                    Min profil
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setUserOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      color: 'var(--color-text-nav-muted)',
                      textDecoration: 'none',
                      fontSize: 'var(--text-sm)',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-nav-muted)'}
                  >
                    <span>Admin</span>
                    {pendingCount > 0 && (
                      <span style={{
                        background: '#ef4444', color: '#fff',
                        borderRadius: 99, padding: '1px 6px',
                        fontSize: 10, fontWeight: 700, lineHeight: 1.6,
                      }}>
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )}
                <button
                  className="btn btn-ghost"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3) var(--space-4)',
                    color: 'var(--color-text-nav-muted)',
                    fontSize: 'var(--text-sm)',
                    textAlign: 'left',
                    borderRadius: 0,
                  }}
                  onClick={() => { setUserOpen(false); signOut() }}
                >
                  Logg ut
                </button>
              </div>
            )}
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
