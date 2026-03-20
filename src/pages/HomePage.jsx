import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { SilhouetteSvg } from '../components/PersonCard'
import { formatName } from '../lib/persons'

// ─── Konstanter ──────────────────────────────────────────
const ARTICLE_TYPE_LABEL = {
  building: 'Bygning',
  street:   'Gate',
  area:     'Område',
  city:     'By',
  biography: 'Biografi',
  event:    'Hendelse',
  occupation: 'Yrke',
  company:  'Bedrift',
  general:  'Artikkel',
}

// ─── Hjelpefunksjoner ─────────────────────────────────────
function formatArticleDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function extractIngress(text, maxLen = 180) {
  if (!text) return ''
  // Fjern markdown-koder og HTML
  const plain = text
    .replace(/^#+\s.*/gm, '')          // fjern overskrifter
    .replace(/\*\*|__|\*|_/g, '')      // fjern bold/italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // lenker → tekst
    .replace(/<[^>]+>/g, '')           // fjern HTML-tagger
    .replace(/\n{2,}/g, '\n')          // komprimer tomme linjer
    .trim()
  // Finn første substansiell linje (>40 tegn)
  const first = plain.split('\n').map(l => l.trim()).find(l => l.length > 40) || plain
  return first.length > maxLen ? first.slice(0, maxLen).replace(/\s\S+$/, '') + '…' : first
}

// ─── HomePage ─────────────────────────────────────────────
export function HomePage() {
  const { personId } = useAuth()

  return (
    <Layout>
      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-hero-title">Familietre</h1>
          <p className="home-hero-subtitle">Utforsk slektens røtter — fra Bergen til verden</p>
        </div>
      </div>

      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-10)', alignItems: 'start' }}>

          {/* Venstre kolonne: artikler */}
          <div>
            <ArticlesFeed />
          </div>

          {/* Høyre kolonne */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {personId && <MyProfile personId={personId} />}
            <RandomPerson />
            <DailyEvents type="birthday" />
            <DailyEvents type="death" />
            <RecentActivity />
          </div>
        </div>
      </div>
    </Layout>
  )
}

// ─── Hurtigstatistikk ─────────────────────────────────────
function QuickStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    Promise.all([
      supabase.from('persons').select('person_id', { count: 'exact', head: true }),
      supabase.from('families').select('family_id', { count: 'exact', head: true }),
    ]).then(([p, f]) => setStats({ persons: p.count || 0, families: f.count || 0 }))
  }, [])
  if (!stats) return null
  return (
    <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
      <StatItem value={stats.persons.toLocaleString('nb-NO')} label="personer i treet" />
      <StatItem value={stats.families.toLocaleString('nb-NO')} label="familier registrert" />
    </div>
  )
}
function StatItem({ value, label }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ─── Artikkelstrøm (NYT-stil) ─────────────────────────────
function ArticlesFeed() {
  const [articles, setArticles] = useState([])
  const [imageUrls, setImageUrls] = useState({})
  const [personPhotos, setPersonPhotos] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Hent stedartikler
      const { data: places } = await supabase
        .from('place_articles')
        .select('id, title, subtitle, body, article_type, city, cover_image_path, updated_at')
        .order('updated_at', { ascending: false })
        .limit(6)

      // Hent biografier med navn
      const { data: bios } = await supabase
        .from('person_biography')
        .select('person_id, biography_text, last_updated')
        .not('biography_text', 'is', null)
        .order('last_updated', { ascending: false })
        .limit(8)

      const bioArticles = []
      if (bios?.length) {
        const ids = bios.map(b => b.person_id)
        const [namesRes, photosRes] = await Promise.all([
          supabase.from('person_names').select('person_id, given_name, middle_name, surname, is_preferred').in('person_id', ids),
          supabase.from('person_photos').select('person_id, drive_url').in('person_id', ids).eq('is_primary', true),
        ])
        const nameMap = {}
        ;(namesRes.data || []).forEach(n => { if (!nameMap[n.person_id] || n.is_preferred) nameMap[n.person_id] = n })
        const photoMap = {}
        ;(photosRes.data || []).forEach(p => { photoMap[p.person_id] = p.drive_url })

        for (const bio of bios) {
          bioArticles.push({
            _type: 'bio',
            id: `bio-${bio.person_id}`,
            personId: bio.person_id,
            title: nameMap[bio.person_id] ? formatName(nameMap[bio.person_id]) : bio.person_id,
            subtitle: null,
            body: bio.biography_text,
            article_type: 'biography',
            city: null,
            cover_image_path: photoMap[bio.person_id] || null,
            updated_at: bio.last_updated,
          })
        }
      }

      // Slå sammen og sorter
      const placeArticles = (places || []).map(a => ({ ...a, _type: 'place' }))
      const combined = [...placeArticles, ...bioArticles]
        .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
        .slice(0, 7)

      setArticles(combined)

      // Hent signerte bilde-URLer for stedartikler
      const placePaths = combined.filter(a => a._type === 'place' && a.cover_image_path).map(a => a.cover_image_path)
      if (placePaths.length) {
        const { data: signed } = await supabase.storage.from('person-photos').createSignedUrls(placePaths, 3600)
        const urls = {}
        ;(signed || []).forEach(s => { urls[s.path] = s.signedUrl })
        setImageUrls(urls)
      }

      // Hent signerte bilde-URLer for biografier
      const bioPaths = combined.filter(a => a._type === 'bio' && a.cover_image_path).map(a => a.cover_image_path)
      if (bioPaths.length) {
        const { data: signed } = await supabase.storage.from('person-photos').createSignedUrls(bioPaths, 3600)
        const photos = {}
        ;(signed || []).forEach(s => { photos[s.path] = s.signedUrl })
        setPersonPhotos(photos)
      }

      setLoading(false)
    }
    load()

    // Realtime: oppdater feeden automatisk når nye artikler/biografier lagres
    const channel = supabase
      .channel('articles-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'person_biography' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_articles' }, () => load())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) return <div className="loading-center" style={{ padding: 'var(--space-12)' }}><div className="spinner" /></div>
  if (!articles.length) return null

  const [featured, ...rest] = articles

  function getImageUrl(a) {
    if (!a.cover_image_path) return null
    return a._type === 'place' ? imageUrls[a.cover_image_path] : personPhotos[a.cover_image_path]
  }

  function getLink(a) {
    if (a._type === 'bio') return `/person/${a.personId}`
    return `/steder?article=${a.id}`
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-6)', color: 'var(--color-text)' }}>
        Fra arkivet
      </h2>

      {/* Featured */}
      <FeaturedArticle article={featured} imageUrl={getImageUrl(featured)} link={getLink(featured)} />

      {/* Grid */}
      {rest.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-5)', marginTop: 'var(--space-6)' }}>
          {rest.slice(0, 6).map(a => (
            <ArticleCard key={a.id} article={a} imageUrl={getImageUrl(a)} link={getLink(a)} />
          ))}
        </div>
      )}
    </div>
  )
}

function FeaturedArticle({ article, imageUrl, link }) {
  const typeLabel = ARTICLE_TYPE_LABEL[article.article_type] || 'Artikkel'
  const ingress   = article.subtitle || extractIngress(article.body, 220)
  const date      = formatArticleDate(article.updated_at)

  return (
    <Link to={link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-bg-card)',
        transition: 'box-shadow 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        {imageUrl && (
          <div style={{ height: 280, overflow: 'hidden' }}>
            <img src={imageUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>{typeLabel}</span>
            {article.city && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>· {article.city}</span>}
            {date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginLeft: 'auto' }}>{date}</span>}
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-3)', lineHeight: 1.25 }}>
            {article.title}
          </h3>
          {ingress && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
              {ingress}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

function ArticleCard({ article, imageUrl, link }) {
  const typeLabel = ARTICLE_TYPE_LABEL[article.article_type] || 'Artikkel'
  const ingress   = article.subtitle || extractIngress(article.body, 100)
  const date      = formatArticleDate(article.updated_at)

  return (
    <Link to={link} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      <div style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--color-bg-card)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        {imageUrl ? (
          <div style={{ height: 140, overflow: 'hidden', flexShrink: 0 }}>
            <img src={imageUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ) : (
          <div style={{ height: 80, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.4 }}>
            <SilhouetteSvg type="unknown" size={36} />
          </div>
        )}
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-accent)', marginBottom: 'var(--space-2)' }}>
            {typeLabel}
          </span>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', fontWeight: 700, lineHeight: 1.3, marginBottom: 'var(--space-2)', flex: 1 }}>
            {article.title}
          </h4>
          {ingress && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 var(--space-3)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {ingress}
            </p>
          )}
          {date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginTop: 'auto' }}>{date}</span>}
        </div>
      </div>
    </Link>
  )
}

// ─── Min profil ───────────────────────────────────────────
function MyProfile({ personId }) {
  const [name, setName]   = useState(null)
  const [photo, setPhoto] = useState(null)

  useEffect(() => {
    async function load() {
      const [namesRes, photoRes] = await Promise.all([
        supabase.from('person_names').select('given_name, middle_name, surname')
          .eq('person_id', personId).eq('is_preferred', true).maybeSingle(),
        supabase.from('person_photos').select('drive_url')
          .eq('person_id', personId).eq('is_primary', true).limit(1),
      ])
      if (namesRes.data) {
        const n = namesRes.data
        setName([n.given_name, n.middle_name, n.surname].filter(Boolean).join(' '))
      }
      const path = photoRes.data?.[0]?.drive_url
      if (path) {
        const { data: signed } = await supabase.storage.from('person-photos').createSignedUrls([path], 3600)
        setPhoto(signed?.[0]?.signedUrl || null)
      }
    }
    load()
  }, [personId])

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        {photo ? (
          <img src={photo} alt={name || ''} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 20%', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SilhouetteSvg type="unknown" size={32} />
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>
          {name || 'Min profil'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Link to={`/person/${personId}`} className="btn btn-secondary btn-sm w-full" style={{ justifyContent: 'center' }}>Se min profil</Link>
        <Link to={`/tre?person=${personId}&mode=aner`} className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center' }}>Mine aner →</Link>
        <Link to={`/tre?person=${personId}&mode=etterkommere`} className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center' }}>Mine etterkommere →</Link>
      </div>
    </div>
  )
}

// ─── Tilfeldig familiemedlem (utvidet) ────────────────────
function RandomPerson() {
  const [person, setPerson]   = useState(null)
  const [name, setName]       = useState(null)
  const [lifespan, setLifespan] = useState(null)
  const [occupation, setOccupation] = useState(null)
  const [photo, setPhoto]     = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadRandom() {
    setLoading(true)
    try {
      const { count } = await supabase.from('persons').select('person_id', { count: 'exact', head: true }).eq('is_deleted', false)
      const offset = Math.floor(Math.random() * (count || 1))
      const { data: [p] } = await supabase.from('persons').select('*').eq('is_deleted', false).range(offset, offset).limit(1)
      if (!p) return

      const [namesRes, factsRes, photoRes, roleRes] = await Promise.all([
        supabase.from('person_names').select('*').eq('person_id', p.person_id),
        supabase.from('person_facts').select('fact_type, date_year').eq('person_id', p.person_id).in('fact_type', ['BIRT', 'DEAT']),
        supabase.from('person_photos').select('drive_url').eq('person_id', p.person_id).eq('is_primary', true).limit(1),
        supabase.from('person_roles').select('value, role_type').eq('person_id', p.person_id).in('role_type', ['occupation', 'military', 'political', 'public_office', 'education']).limit(3),
      ])

      setPerson(p)

      // Navn
      const names = namesRes.data || []
      const preferred = names.find(n => n.is_preferred) || names[0]
      setName(preferred ? formatName(preferred) : null)

      // Livsår
      const facts = factsRes.data || []
      const birt = facts.find(f => f.fact_type === 'BIRT')?.date_year
      const deat = facts.find(f => f.fact_type === 'DEAT')?.date_year
      setLifespan(birt ? (deat ? `${birt} – ${deat}` : `f. ${birt}`) : null)

      // Yrke — velg occupation fremfor education
      const roles = roleRes.data || []
      const occ = roles.find(r => r.role_type === 'occupation') || roles.find(r => r.role_type !== 'education') || roles[0]
      setOccupation(occ?.value || null)

      // Bilde
      const path = photoRes.data?.[0]?.drive_url
      if (path) {
        const { data: signed } = await supabase.storage.from('person-photos').createSignedUrls([path], 3600)
        setPhoto(signed?.[0]?.signedUrl || null)
      } else {
        setPhoto(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRandom() }, [])

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)' }}>Tilfeldig familiemedlem</h4>
        <button className="btn btn-ghost btn-sm" onClick={loadRandom} disabled={loading} title="Vis et annet">↻</button>
      </div>

      {loading ? (
        <div className="loading-center" style={{ padding: 'var(--space-6)' }}><div className="spinner" /></div>
      ) : person ? (
        <Link to={`/person/${person.person_id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <div style={{ width: 56, height: 56, borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, background: 'var(--color-bg)' }}>
            {photo ? (
              <img src={photo} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                <SilhouetteSvg type={person.sex === 'M' ? 'male' : person.sex === 'F' ? 'female' : 'unknown'} size={32} />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name || person.person_id}
            </div>
            {lifespan && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>{lifespan}</div>}
            {occupation && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {occupation}
              </div>
            )}
          </div>
        </Link>
      ) : null}
    </div>
  )
}

// ─── Daglige hendelser (fødselsdager / dødsfall) ──────────
function DailyEvents({ type }) {
  const [items, setItems]   = useState([])
  const [names, setNames]   = useState({})
  const [loading, setLoading] = useState(true)

  const isBirthday = type === 'birthday'
  const factType   = isBirthday ? 'BIRT' : 'DEAT'
  const title      = isBirthday ? 'Dagens fødselsdager' : 'Dagens dødsfall'

  useEffect(() => {
    async function load() {
      const today = new Date()
      const { data: facts } = await supabase
        .from('person_facts')
        .select('fact_type, date_month, date_day, date_year, person_id, persons!inner(is_living)')
        .eq('fact_type', factType)
        .eq('date_month', today.getMonth() + 1)
        .eq('date_day', today.getDate())
        .limit(8)

      if (facts?.length) {
        setItems(facts)
        const ids = facts.map(f => f.person_id)
        const { data: nameRows } = await supabase
          .from('person_names').select('person_id, given_name, surname, middle_name, is_preferred').in('person_id', ids)
        const map = {}
        ;(nameRows || []).forEach(n => { if (!map[n.person_id] || n.is_preferred) map[n.person_id] = n })
        setNames(map)
      }
      setLoading(false)
    }
    load()
  }, [factType])

  if (loading || items.length === 0) return null

  const today = new Date()

  return (
    <div className="card">
      <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map(item => {
          const n = names[item.person_id]
          const fullName = n ? formatName(n) : item.person_id
          const year = item.date_year
          const age = year ? today.getFullYear() - year : null
          const ageText = age
            ? isBirthday
              ? (item.persons?.is_living ? `fyller ${age}` : `ville fylt ${age}`)
              : `– ${year} · ${age} år gammel`
            : year ? (isBirthday ? `f. ${year}` : `– ${year}`) : null

          return (
            <Link key={item.person_id + item.fact_type} to={`/person/${item.person_id}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)', textDecoration: 'none', color: 'var(--color-text)', padding: '2px 0' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</span>
              {ageText && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flexShrink: 0 }}>{ageText}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Siste aktivitet ──────────────────────────────────────
function RecentActivity() {
  const [items, setItems]     = useState([])
  const [namesMap, setNamesMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('person_biography')
        .select('person_id, last_updated, updated_by, is_ai_generated')
        .order('last_updated', { ascending: false })
        .not('last_updated', 'is', null)
        .limit(8)

      if (data?.length) {
        setItems(data)
        const ids = data.map(d => d.person_id)
        const { data: nameRows } = await supabase
          .from('person_names').select('person_id, given_name, surname, middle_name, is_preferred').in('person_id', ids)
        const map = {}
        ;(nameRows || []).forEach(n => { if (!map[n.person_id] || n.is_preferred) map[n.person_id] = n })
        const formatted = {}
        Object.entries(map).forEach(([id, n]) => { formatted[id] = formatName(n) })
        setNamesMap(formatted)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="card">
      <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>Siste aktivitet</h4>
      {loading ? (
        <div className="loading-center" style={{ padding: 'var(--space-4)' }}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Ingen aktivitet ennå.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {items.map(item => {
            const date = item.last_updated
              ? new Date(item.last_updated).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
              : ''
            return (
              <Link key={item.person_id} to={`/person/${item.person_id}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', textDecoration: 'none', color: 'var(--color-text)', padding: 'var(--space-1) 0' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{namesMap[item.person_id] || item.person_id}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-2)' }}>
                    {item.is_ai_generated ? 'AI-biografi' : 'Biografi oppdatert'}
                  </span>
                </div>
                {date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', flexShrink: 0 }}>{date}</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
