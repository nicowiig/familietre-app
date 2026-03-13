import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'

// Enkel Markdown-renderer — støtter ## overskrifter, ### overskrifter, **bold**, avsnitt
function renderMarkdown(md) {
  if (!md) return null
  const lines = md.split('\n')
  const elements = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginTop: 'var(--space-5)', marginBottom: 'var(--space-1)', color: 'var(--color-text)' }}>
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)', color: 'var(--color-text)' }}>
          {line.slice(3)}
        </h2>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 'var(--space-3)' }} />)
    } else {
      // Inline bold: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      const rendered = parts.map((p, j) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={j}>{p.slice(2, -2)}</strong>
          : p
      )
      elements.push(
        <p key={key++} style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text)' }}>
          {rendered}
        </p>
      )
    }
  }
  return elements
}

export function PlacePage() {
  const { articleId } = useParams()
  const [article,    setArticle]    = useState(null)
  const [images,     setImages]     = useState([])
  const [persons,    setPersons]    = useState([])
  const [sources,    setSources]    = useState([])
  const [address,    setAddress]    = useState(null)
  const [coverUrl,   setCoverUrl]   = useState(null)
  const [personNames, setPersonNames] = useState({}) // person_id → display name
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)
  const [activeImg,  setActiveImg]  = useState(0)

  useEffect(() => {
    if (articleId) load(articleId)
  }, [articleId])

  async function load(id) {
    setLoading(true)
    setNotFound(false)
    try {
      // Hent artikkel med alle relasjoner
      const { data, error } = await supabase
        .from('place_articles')
        .select(`
          *,
          place_article_images(*),
          place_article_persons(*),
          place_article_sources(*),
          addresses(id, building_name, street_name, house_number, house_letter, city, country)
        `)
        .eq('id', id)
        .single()

      if (error || !data) { setNotFound(true); return }

      const imgs    = (data.place_article_images  || []).sort((a, b) => a.sort_order - b.sort_order)
      const persCon = (data.place_article_persons || [])
      const srcs    = (data.place_article_sources || []).sort((a, b) => a.sort_order - b.sort_order)

      setArticle(data)
      setImages(imgs)
      setPersons(persCon)
      setSources(srcs)
      setAddress(data.addresses || null)

      // Signed URL for forsidebilde
      if (data.cover_image_path) {
        const { data: signed } = await supabase.storage
          .from('person-photos')
          .createSignedUrl(data.cover_image_path, 3600)
        if (signed?.signedUrl) setCoverUrl(signed.signedUrl)
      }

      // Signed URLs for galleri-bilder (ekskluderer cover hvis samme path)
      const galleryImgs = imgs.filter(img => img.storage_path !== data.cover_image_path)
      if (galleryImgs.length > 0) {
        const { data: signedList } = await supabase.storage
          .from('person-photos')
          .createSignedUrls(galleryImgs.map(i => i.storage_path), 3600)
        const urlMap = {}
        ;(signedList || []).forEach(s => { urlMap[s.path] = s.signedUrl })
        setImages(imgs.map(img => ({ ...img, signedUrl: urlMap[img.storage_path] || null })))
      } else {
        setImages(imgs.map(img =>
          img.storage_path === data.cover_image_path
            ? img
            : img
        ))
      }

      // Hent personnavn
      const personIds = persCon.map(p => p.person_id)
      if (personIds.length > 0) {
        const { data: nameRows } = await supabase
          .from('person_names')
          .select('person_id, given_name, surname, middle_name, is_preferred')
          .in('person_id', personIds)
        const nameMap = {}
        ;(nameRows || []).forEach(n => {
          if (!nameMap[n.person_id] || n.is_preferred) {
            const parts = [n.given_name, n.middle_name, n.surname].filter(Boolean)
            nameMap[n.person_id] = parts.join(' ')
          }
        })
        setPersonNames(nameMap)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Layout><LoadingSpinner /></Layout>

  if (notFound) {
    return (
      <Layout>
        <div className="content-container" style={{ paddingTop: 'var(--space-10)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>Artikkelen ble ikke funnet.</p>
          <Link to="/" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>Til forsiden</Link>
        </div>
      </Layout>
    )
  }

  const addrLine = address
    ? [
        address.street_name
          ? `${address.street_name} ${address.house_number || ''}${address.house_letter || ''}`.trim()
          : null,
        address.city,
        address.country,
      ].filter(Boolean).join(', ')
    : [article.locality, article.city, article.country].filter(Boolean).join(', ')

  // Alle bilder til galleriet (forsidebilde alltid først)
  const allGalleryImages = coverUrl
    ? [{ storage_path: article.cover_image_path, signedUrl: coverUrl, caption: images[0]?.caption, year: images[0]?.year, creator: images[0]?.creator, sort_order: -1 }, ...images.filter(i => i.storage_path !== article.cover_image_path)]
    : images.filter(i => i.signedUrl)

  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)', maxWidth: 760 }}>

        {/* ── Forsidebilde ── */}
        {coverUrl && (
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 'var(--space-6)', background: 'var(--color-bg-alt)' }}>
            <img
              src={coverUrl}
              alt={article.title}
              style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block', background: '#f5f0e8' }}
            />
            {images[0]?.caption && (
              <div style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--color-border)' }}>
                {images[0].caption}
                {images[0].year && ` (${images[0].year})`}
                {images[0].creator && ` · ${images[0].creator}`}
              </div>
            )}
          </div>
        )}

        {/* ── Tittel og metadata ── */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
            {article.title}
          </h1>
          {article.subtitle && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              {article.subtitle}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>
            {addrLine && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📍</span> {addrLine}
              </span>
            )}
            {(article.period_from || article.period_to) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🕰</span>
                {[article.period_from, article.period_to].filter(Boolean).join(' – ')}
              </span>
            )}
            {address?.building_name && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🏛</span> {address.building_name}
              </span>
            )}
          </div>
        </div>

        {/* ── Brødtekst ── */}
        {article.body && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
            {renderMarkdown(article.body)}
          </div>
        )}

        {/* ── Bildegalleri (ekstra bilder utover forsidebilde) ── */}
        {allGalleryImages.length > 1 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
            <h2 className="profile-section-header" style={{ marginBottom: 'var(--space-3)' }}>Bilder</h2>
            <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
              {allGalleryImages.map((img, idx) =>
                img.signedUrl ? (
                  <button
                    key={idx}
                    onClick={() => setActiveImg(idx)}
                    style={{
                      border: activeImg === idx ? '2px solid var(--color-accent)' : '2px solid transparent',
                      borderRadius: 'var(--radius)',
                      padding: 0,
                      background: 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={img.signedUrl}
                      alt={img.caption || `Bilde ${idx + 1}`}
                      style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 'var(--radius)', display: 'block' }}
                    />
                  </button>
                ) : null
              )}
            </div>
            {allGalleryImages[activeImg] && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <img
                  src={allGalleryImages[activeImg].signedUrl}
                  alt={allGalleryImages[activeImg].caption || article.title}
                  style={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 'var(--radius)', background: '#f5f0e8' }}
                />
                {(allGalleryImages[activeImg].caption || allGalleryImages[activeImg].creator) && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 'var(--space-2)' }}>
                    {allGalleryImages[activeImg].caption}
                    {allGalleryImages[activeImg].year && ` (${allGalleryImages[activeImg].year})`}
                    {allGalleryImages[activeImg].creator && ` · ${allGalleryImages[activeImg].creator}`}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tilknyttede personer ── */}
        {persons.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
            <h2 className="profile-section-header" style={{ marginBottom: 'var(--space-3)' }}>Tilknyttede personer</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {persons.map(p => (
                <div key={p.person_id} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Link
                    to={`/person/${p.person_id}`}
                    style={{ color: 'var(--color-accent)', fontWeight: 500, textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3 }}
                  >
                    {personNames[p.person_id] || p.person_id}
                  </Link>
                  {p.role_note && (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                      — {p.role_note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Kilder ── */}
        {sources.length > 0 && (
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h2 className="profile-section-header" style={{ marginBottom: 'var(--space-3)' }}>Kilder</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {sources.map((s, i) => (
                <li key={s.id || i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  {s.url
                    ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3 }}>{s.title}</a>
                    : <span>{s.title}</span>
                  }
                  {(s.publisher || s.year) && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {' '}— {[s.publisher, s.year].filter(Boolean).join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Tilbake-lenke ── */}
        <div style={{ marginTop: 'var(--space-8)' }}>
          <button
            onClick={() => window.history.back()}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent)', fontSize: 'var(--text-sm)', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3 }}
          >
            ← Tilbake
          </button>
        </div>

      </div>
    </Layout>
  )
}
