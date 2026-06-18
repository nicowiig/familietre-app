import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'

// In-memory cache for preview-data (per sesjon)
const previewCache = {}

async function fetchPersonPreview(personId) {
  if (previewCache[`person:${personId}`]) return previewCache[`person:${personId}`]

  const [{ data: person }, { data: names }, { data: facts }, { data: photos }] = await Promise.all([
    supabase.from('persons').select('person_id, sex, is_living').eq('person_id', personId).single(),
    supabase.from('person_names').select('given_name, middle_name, surname, is_preferred').eq('person_id', personId),
    supabase.from('person_facts').select('fact_type, date_year, place_city, place_raw').eq('person_id', personId).in('fact_type', ['BIRT', 'DEAT']),
    supabase.from('person_photos').select('drive_url, is_primary').eq('person_id', personId).order('photo_order').limit(5),
  ])

  if (!person) return null

  // Navn
  const preferred = (names || []).find(n => n.is_preferred) || (names || [])[0] || {}
  const fullName = [preferred.given_name, preferred.middle_name, preferred.surname].filter(Boolean).join(' ')

  // Årstall
  const birth = (facts || []).find(f => f.fact_type === 'BIRT')
  const death = (facts || []).find(f => f.fact_type === 'DEAT')
  const birthYear = birth?.date_year
  const deathYear = death?.date_year
  const birthPlace = birth?.place_city || birth?.place_raw

  let lifespan = ''
  if (birthYear && deathYear) lifespan = `${birthYear}–${deathYear}`
  else if (birthYear && person.is_living) lifespan = `f. ${birthYear}`
  else if (birthYear) lifespan = `f. ${birthYear}`

  // Bilde — bruk primærbilde, fallback til første
  let photoUrl = null
  const primaryPhoto = (photos || []).find(p => p.is_primary) || (photos || [])[0]
  if (primaryPhoto) {
    const { data: signed } = await supabase.storage
      .from('person-photos')
      .createSignedUrl(primaryPhoto.drive_url, 3600)
    photoUrl = signed?.signedUrl || null
  }

  const result = { type: 'person', fullName, lifespan, birthPlace, photoUrl, sex: person.sex }
  previewCache[`person:${personId}`] = result
  return result
}

async function fetchPlacePreview(articleId) {
  if (previewCache[`place:${articleId}`]) return previewCache[`place:${articleId}`]

  const { data } = await supabase
    .from('place_articles')
    .select('title, subtitle, period_from, period_to, cover_image_path, addresses(street_name, house_number, house_letter, city)')
    .eq('id', articleId)
    .single()

  if (!data) return null

  let coverUrl = null
  if (data.cover_image_path) {
    const { data: signed } = await supabase.storage
      .from('person-photos')
      .createSignedUrl(data.cover_image_path, 3600)
    coverUrl = signed?.signedUrl || null
  }

  const addr = data.addresses
  const location = addr
    ? [addr.street_name ? `${addr.street_name} ${addr.house_number || ''}${addr.house_letter || ''}`.trim() : null, addr.city].filter(Boolean).join(', ')
    : null

  const period = [data.period_from, data.period_to].filter(Boolean).join(' – ')

  const result = { type: 'place', title: data.title, subtitle: data.subtitle, period, location, coverUrl }
  previewCache[`place:${articleId}`] = result
  return result
}

// Silhouette SVG inline
function MiniSilhouette({ sex }) {
  const color = '#c8b89a'
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill={color}>
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  )
}

export function LinkPreview({ to, children }) {
  const [show, setShow] = useState(false)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState('below')
  const timeoutRef = useRef(null)
  const linkRef = useRef(null)
  const popoverRef = useRef(null)
  const isTouchDevice = useRef(false)

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  const fetchData = useCallback(async () => {
    if (preview || loading) return
    setLoading(true)

    try {
      let data = null
      const personMatch = to.match(/^\/person\/(.+)$/)
      const placeMatch = to.match(/^\/place\/(.+)$/)

      if (personMatch) {
        data = await fetchPersonPreview(personMatch[1])
      } else if (placeMatch) {
        data = await fetchPlacePreview(placeMatch[1])
      }

      setPreview(data)
    } catch (e) {
      // Stille feil — popover vises bare ikke
    } finally {
      setLoading(false)
    }
  }, [to, preview, loading])

  const handleMouseEnter = useCallback(() => {
    if (isTouchDevice.current) return
    timeoutRef.current = setTimeout(() => {
      setShow(true)
      fetchData()

      // Beregn posisjon
      if (linkRef.current) {
        const rect = linkRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        setPosition(spaceBelow < 200 ? 'above' : 'below')
      }
    }, 300)
  }, [fetchData])

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timeoutRef.current)
    // Kort delay for å la brukeren flytte musen til popoveren
    timeoutRef.current = setTimeout(() => setShow(false), 150)
  }, [])

  const handlePopoverEnter = useCallback(() => {
    clearTimeout(timeoutRef.current)
  }, [])

  const handlePopoverLeave = useCallback(() => {
    setShow(false)
  }, [])

  return (
    <span className="link-preview-wrapper" style={{ position: 'relative', display: 'inline' }}>
      <Link
        ref={linkRef}
        to={to}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ color: 'var(--color-accent)', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3 }}
      >
        {children}
      </Link>

      {show && (preview || loading) && (
        <div
          ref={popoverRef}
          className={`link-preview-popover link-preview-${position}`}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
        >
          {loading && !preview ? (
            <div className="link-preview-loading">Laster...</div>
          ) : preview?.type === 'person' ? (
            <div className="link-preview-content">
              <div className="link-preview-photo">
                {preview.photoUrl ? (
                  <img src={preview.photoUrl} alt={preview.fullName} />
                ) : (
                  <div className="link-preview-silhouette">
                    <MiniSilhouette sex={preview.sex} />
                  </div>
                )}
              </div>
              <div className="link-preview-info">
                <div className="link-preview-name">{preview.fullName}</div>
                {preview.lifespan && <div className="link-preview-meta">{preview.lifespan}</div>}
                {preview.birthPlace && <div className="link-preview-meta">{preview.birthPlace}</div>}
              </div>
            </div>
          ) : preview?.type === 'place' ? (
            <div className="link-preview-content">
              {preview.coverUrl && (
                <div className="link-preview-cover">
                  <img src={preview.coverUrl} alt={preview.title} />
                </div>
              )}
              <div className="link-preview-info">
                <div className="link-preview-name">{preview.title}</div>
                {preview.period && <div className="link-preview-meta">🕰 {preview.period}</div>}
                {preview.location && <div className="link-preview-meta">📍 {preview.location}</div>}
                {preview.subtitle && <div className="link-preview-subtitle">{preview.subtitle}</div>}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </span>
  )
}
