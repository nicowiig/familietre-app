import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { loadDisplayTitles } from '../lib/titles'
import { loadPlaceTimeData } from '../lib/places'
import { LoadingSpinner } from '../components/LoadingSpinner'

/**
 * Laster titlene som vises foran navn (grevinne, kong …) én gang etter
 * innlogging, før sidene tegnes – slik at formatName() har dem fra start.
 */
export function TitlesProvider({ children }) {
  const { isApproved } = useAuth()
  const [loadedFor, setLoadedFor] = useState(false)

  useEffect(() => {
    if (!isApproved || loadedFor) return
    let cancelled = false
    Promise.all([loadDisplayTitles(), loadPlaceTimeData()]).finally(() => { if (!cancelled) setLoadedFor(true) })
    return () => { cancelled = true }
  }, [isApproved, loadedFor])

  if (isApproved && !loadedFor) return <LoadingSpinner fullPage text="Laster…" />
  return children
}
