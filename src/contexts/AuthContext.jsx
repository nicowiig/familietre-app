import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]       = useState(undefined)  // undefined = laster
  const [access, setAccess]         = useState(undefined)  // undefined = ikke sjekket ennå
  const [loadingAccess, setLoading] = useState(false)

  // Hent tilgangsrad fra databasen
  async function fetchAccess(userId) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('familietre_tilganger')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      setAccess(data)
    } catch {
      setAccess(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // onAuthStateChange leverer INITIAL_SESSION ved oppstart — ingen separat getSession() nødvendig.
    // VIKTIG: Ikke bruk async/await inne i callbacken — gotrue-js holder auth-locken mens
    // subscribers kjøres, og await-ing her forhindrer token-refresh fra å ta locken → 5000ms timeout.
    // fetchAccess kalles uten await og kjører parallelt mens app-en allerede viser innhold.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user) {
          fetchAccess(session.user.id)
        } else {
          setAccess(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: window.location.origin + '/familietre-app/',
      },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAccess(null)
  }

  async function submitAccessRequest(message) {
    if (!session?.user) throw new Error('Ikke innlogget')
    const { error } = await supabase
      .from('familietre_tilganger')
      .insert({
        user_id:      session.user.id,
        email:        session.user.email,
        display_name: session.user.user_metadata?.full_name || session.user.email,
        status:       'pending',
        message:      message || null,
      })
    if (error) throw error
    await fetchAccess(session.user.id)
  }

  // Beregn tilstandsstatus
  // loading = sant KUN mens vi venter på selve sesjonen (rask, fra localStorage)
  // Tilgangssjekk er separat og blokkerer ikke routing
  const loading = session === undefined

  let status = 'unauthenticated'
  if (!loading) {
    if (!session) {
      status = 'unauthenticated'
    } else if (access === undefined || loadingAccess) {
      status = 'checking_access' // innlogget, sjekker tilgang
    } else if (!access) {
      status = 'needs_request'
    } else if (access.status === 'pending') {
      status = 'pending'
    } else if (access.status === 'rejected') {
      status = 'rejected'
    } else if (access.status === 'approved' && access.is_admin) {
      status = 'admin'
    } else if (access.status === 'approved') {
      status = 'approved'
    }
  }

  const value = {
    session,
    access,
    status,
    loading,
    isAdmin:      status === 'admin',
    isApproved:   status === 'approved' || status === 'admin',
    user:         session?.user ?? null,
    personId:     access?.person_id ?? null,
    signInWithGoogle,
    signOut,
    submitAccessRequest,
    refreshAccess: () => session?.user ? fetchAccess(session.user.id) : null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
