import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'

// Leaflet default-ikon patch (React/Vite-bug)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

// Bygg [lat, lng] fra coordinates_lat / coordinates_lng
function parseCoords(lat, lng) {
  const la = parseFloat(lat)
  const lo = parseFloat(lng)
  if (isNaN(la) || isNaN(lo)) return null
  return [la, lo]
}

const ARTICLE_TYPE_LABEL = {
  building:  'Bygning',
  street:    'Gate',
  district:  'Nabolag',
  city:      'By',
  farm:      'Gård',
}

function articleTypeChip(type) {
  const label = ARTICLE_TYPE_LABEL[type] || type || 'Sted'
  return (
    <span style={{
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 99,
      background: 'rgba(192,154,90,0.15)',
      color: 'var(--color-accent)',
      letterSpacing: '0.02em',
    }}>
      {label}
    </span>
  )
}

function StatCard({ value, label }) {
  return (
    <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', flex: '1 1 140px', minWidth: 120 }}>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
        {label}
      </div>
    </div>
  )
}

function TopList({ title, items }) {
  if (!items || items.length === 0) return null
  const max = items[0]?.count || 1
  return (
    <div className="card" style={{ padding: 'var(--space-5)', flex: '1 1 220px', minWidth: 200 }}>
      <h3 style={{ fontWeight: 600, fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map(({ name, count }) => (
          <div key={name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 3 }}>
              <span style={{ color: 'var(--color-text)' }}>{name}</span>
              <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            </div>
            <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: 'var(--color-accent)', borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FunFactCard({ icon, value, label, sub }) {
  return (
    <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-accent)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function groupCount(arr, key) {
  const map = {}
  for (const item of arr) {
    const v = key ? item[key] : item
    if (!v) continue
    map[v] = (map[v] || 0) + 1
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

const MONTHS = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']

export function StederPage() {
  const [articles,    setArticles]    = useState([])
  const [articleUrls, setArticleUrls] = useState({})
  const [stats,       setStats]       = useState({ addresses: null, cities: null, countries: null })
  const [mapAddrs,    setMapAddrs]    = useState([])
  const [topBosteder, setTopBosteder] = useState([])
  const [topBirths,   setTopBirths]   = useState([])
  const [topDeaths,   setTopDeaths]   = useState([])
  const [funFacts,    setFunFacts]    = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([
        loadArticles(),
        loadStats(),
        loadMapAddresses(),
        loadTopLists(),
        loadFunFacts(),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadArticles() {
    const { data } = await supabase
      .from('place_articles')
      .select('id, title, subtitle, article_type, city, country, period_from, period_to, cover_image_path')
      .order('city')
    if (!data) return
    setArticles(data)

    // Signed URLs for forsidebilder
    const paths = data.filter(a => a.cover_image_path).map(a => a.cover_image_path)
    if (paths.length > 0) {
      const { data: signedList } = await supabase.storage
        .from('person-photos')
        .createSignedUrls(paths, 3600)
      const urlMap = {}
      ;(signedList || []).forEach(s => { urlMap[s.path] = s.signedUrl })
      setArticleUrls(urlMap)
    }
  }

  async function loadStats() {
    const [
      { count: addrCount },
      { data: addrCityData },
      { data: addrCountryData },
      { data: factCityData },
      { data: factCountryData },
    ] = await Promise.all([
      supabase.from('addresses').select('id', { count: 'exact', head: true }),
      supabase.from('addresses').select('city').not('city', 'is', null),
      supabase.from('addresses').select('country_code').not('country_code', 'is', null),
      supabase.from('person_facts').select('place_city').in('fact_type', ['BIRT','DEAT','RESI']).not('place_city', 'is', null),
      supabase.from('person_facts').select('place_country').in('fact_type', ['BIRT','DEAT','RESI']).not('place_country', 'is', null),
    ])

    // Slå sammen byer og land fra begge kilder
    const allCities = new Set([
      ...(addrCityData    || []).map(r => r.city?.trim().toLowerCase()).filter(Boolean),
      ...(factCityData    || []).map(r => r.place_city?.trim().toLowerCase()).filter(Boolean),
    ])
    const allCountries = new Set([
      ...(addrCountryData || []).map(r => r.country_code?.trim().toLowerCase()).filter(Boolean),
      ...(factCountryData || []).map(r => {
        // Normaliser land til kode for deduplisering
        const c = r.place_country?.trim().toLowerCase()
        if (!c) return null
        if (c.includes('norge') || c === 'norway' || c === 'no') return 'no'
        if (c.includes('danmark') || c === 'denmark' || c === 'dk') return 'dk'
        if (c.includes('sverige') || c === 'sweden' || c === 'se') return 'se'
        if (c.includes('tyskland') || c === 'germany' || c === 'de') return 'de'
        if (c.includes('england') || c === 'gb' || c === 'uk') return 'gb'
        if (c === 'usa' || c === 'us') return 'us'
        return c
      }).filter(Boolean),
    ])

    setStats({ addresses: addrCount, cities: allCities.size, countries: allCountries.size })
  }

  async function loadMapAddresses() {
    const { data } = await supabase
      .from('addresses')
      .select('id, display_name, building_name, street_name, house_number, city, country, coordinates_lat, coordinates_lng')
      .not('coordinates_lat', 'is', null)
    if (!data) return

    // Hent tilknyttede place_articles for lenker
    const addrIds = data.map(a => a.id)
    const { data: articles } = await supabase
      .from('place_articles')
      .select('id, title, address_id')
      .in('address_id', addrIds)
    const articleMap = {}
    ;(articles || []).forEach(a => { articleMap[a.address_id] = { id: a.id, title: a.title } })

    const parsed = data.map(a => ({
      ...a,
      latlng: parseCoords(a.coordinates_lat, a.coordinates_lng),
      article: articleMap[a.id] || null,
    })).filter(a => a.latlng)
    setMapAddrs(parsed)
  }

  async function loadTopLists() {
    const [{ data: periods }, { data: births }, { data: deaths }] = await Promise.all([
      supabase.from('address_periods').select('addresses(city, country)'),
      supabase.from('person_facts').select('place_city').eq('fact_type', 'BIRT').not('place_city', 'is', null),
      supabase.from('person_facts').select('place_city').eq('fact_type', 'DEAT').not('place_city', 'is', null),
    ])

    // Bosteder: hent by fra nested addresses
    const cities = (periods || [])
      .map(p => p.addresses?.city)
      .filter(Boolean)
    setTopBosteder(groupCount(cities).slice(0, 8))
    setTopBirths(groupCount(births || [], 'place_city').slice(0, 8))
    setTopDeaths(groupCount(deaths || [], 'place_city').slice(0, 8))
  }

  async function loadFunFacts() {
    const [
      { data: birtFacts },
      { data: deatFacts },
      { data: persons },
      { data: names },
      { data: families },
    ] = await Promise.all([
      supabase.from('person_facts').select('person_id, date_year, date_month').eq('fact_type', 'BIRT'),
      supabase.from('person_facts').select('person_id, date_year').eq('fact_type', 'DEAT'),
      supabase.from('persons').select('person_id, sex'),
      supabase.from('person_names').select('given_name, surname').eq('is_preferred', true),
      supabase.from('families').select('family_id, children'),
    ])

    // Kjønnsfordeling
    const sexCount = { M: 0, F: 0, U: 0 }
    ;(persons || []).forEach(p => {
      const s = p.sex?.toUpperCase()
      if (s === 'M') sexCount.M++
      else if (s === 'F') sexCount.F++
      else sexCount.U++
    })

    // Alder og lengst levde
    const birtMap = {}
    ;(birtFacts || []).forEach(f => { if (f.date_year) birtMap[f.person_id] = f.date_year })
    const deatMap = {}
    ;(deatFacts || []).forEach(f => { if (f.date_year) deatMap[f.person_id] = f.date_year })

    const ages = Object.keys(birtMap)
      .filter(id => deatMap[id])
      .map(id => ({ id, age: deatMap[id] - birtMap[id] }))
      .filter(a => a.age >= 0 && a.age <= 120)

    const avgAge = ages.length ? Math.round(ages.reduce((s, a) => s + a.age, 0) / ages.length) : null
    const longest = ages.length ? ages.reduce((max, a) => a.age > max.age ? a : max, ages[0]) : null

    // Eldste (laveste fødselsår)
    const allBirths = Object.entries(birtMap).map(([id, year]) => ({ id, year }))
    const oldest = allBirths.length ? allBirths.reduce((min, a) => a.year < min.year ? a : min, allBirths[0]) : null
    // Yngste (høyeste fødselsår)
    const youngest = allBirths.length ? allBirths.reduce((max, a) => a.year > max.year ? a : max, allBirths[0]) : null
    const genSpan = (oldest && youngest) ? youngest.year - oldest.year : null

    // Mest populære fornavn og etternavn
    const firstNames = groupCount(names || [], 'given_name').slice(0, 5)
    const lastNames  = groupCount(names || [], 'surname').slice(0, 5)

    // Mest brukte fødselsmåned
    const monthCounts = {}
    ;(birtFacts || []).forEach(f => {
      if (f.date_month) monthCounts[f.date_month] = (monthCounts[f.date_month] || 0) + 1
    })
    const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]

    // Flest barn
    let mostKids = null
    if (families) {
      const parsed = families.map(f => {
        let count = 0
        try { count = Array.isArray(f.children) ? f.children.length : (f.children ? JSON.parse(f.children).length : 0) } catch {}
        return { id: f.family_id, count }
      }).filter(f => f.count > 0)
      if (parsed.length) mostKids = parsed.reduce((max, f) => f.count > max.count ? f : max, parsed[0])
    }

    setFunFacts({
      avgAge,
      longestAge: longest?.age,
      genSpan,
      sexCount,
      firstNames,
      lastNames,
      topMonth: topMonth ? { month: MONTHS[topMonth[0] - 1] || topMonth[0], count: topMonth[1] } : null,
      mostKids: mostKids?.count,
    })
  }

  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
            Steder
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>
            Bosteder, bygninger og historisk geografi
          </p>
        </div>

        {loading ? <LoadingSpinner /> : (
          <>
            {/* ── Artikkelfeed ── */}
            {articles.length > 0 && (
              <div style={{ marginBottom: 'var(--space-10)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
                  Stedsartikler
                </h2>
                <div className="cards-grid">
                  {articles.map(a => {
                    const imgUrl = articleUrls[a.cover_image_path]
                    const period = [a.period_from, a.period_to].filter(Boolean).join(' – ')
                    return (
                      <Link
                        key={a.id}
                        to={`/place/${a.id}`}
                        className="card"
                        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
                      >
                        <div style={{ height: 160, background: 'var(--color-bg-alt)', overflow: 'hidden', flexShrink: 0 }}>
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={a.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, opacity: 0.3 }}>
                              🏛
                            </div>
                          )}
                        </div>
                        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--color-text)', lineHeight: 1.3 }}>{a.title}</span>
                            {articleTypeChip(a.article_type)}
                          </div>
                          {a.subtitle && (
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{a.subtitle}</span>
                          )}
                          <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginTop: 'auto', flexWrap: 'wrap' }}>
                            {a.city && <span>📍 {a.city}</span>}
                            {period && <span>🕰 {period}</span>}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Hurtigtall ── */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-10)' }}>
              <StatCard value={stats.addresses} label="Normaliserte adresser" />
              <StatCard value={stats.cities}    label="Unike byer i arkivet" />
              <StatCard value={stats.countries} label="Land representert" />
            </div>

            {/* ── Interaktivt kart ── */}
            {mapAddrs.length > 0 && (
              <div style={{ marginBottom: 'var(--space-10)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
                  Kart over bosteder
                </h2>
                <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <MapContainer
                    center={[60.39, 5.32]}
                    zoom={5}
                    style={{ height: 480, width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {mapAddrs.map(a => (
                      <CircleMarker
                        key={a.id}
                        center={a.latlng}
                        radius={9}
                        pathOptions={{ color: '#c09a5a', fillColor: '#c09a5a', fillOpacity: 0.75, weight: 1.5 }}
                      >
                        <Popup>
                          <div style={{ minWidth: 140 }}>
                            <strong style={{ display: 'block', marginBottom: 4 }}>
                              {a.building_name || [a.street_name, a.house_number].filter(Boolean).join(' ') || a.display_name || 'Ukjent adresse'}
                            </strong>
                            {a.city && <span style={{ fontSize: 12, color: '#666' }}>{a.city}</span>}
                            {a.article && (
                              <div style={{ marginTop: 6 }}>
                                <a href={`/familietre-app/place/${a.article.id}`} style={{ color: '#c09a5a', fontSize: 12 }}>
                                  Les artikkel →
                                </a>
                              </div>
                            )}
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            )}

            {/* ── Geografi-statistikk ── */}
            <div style={{ marginBottom: 'var(--space-10)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
                Geografi-statistikk
              </h2>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <TopList title="Bosteder — toppbyer"  items={topBosteder} />
                <TopList title="Fødesteder — toppbyer" items={topBirths}   />
                <TopList title="Dødesteder — toppbyer" items={topDeaths}   />
              </div>
            </div>

            {/* ── Morsomme slektsstatistikker ── */}
            {funFacts && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
                  Slektsstatistikk
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                  {funFacts.avgAge && (
                    <FunFactCard icon="🎂" value={`${funFacts.avgAge} år`} label="Gjennomsnittsalder" sub="Beregnet for kjente f/d-år" />
                  )}
                  {funFacts.longestAge && (
                    <FunFactCard icon="🏆" value={`${funFacts.longestAge} år`} label="Lengst levde person" />
                  )}
                  {funFacts.genSpan && (
                    <FunFactCard icon="📅" value={`${funFacts.genSpan} år`} label="Generasjonsspenn" sub="Fra eldste til yngste f.år" />
                  )}
                  {funFacts.sexCount && (
                    <FunFactCard icon="⚖️" value={`${funFacts.sexCount.M}M / ${funFacts.sexCount.F}K`} label="Kjønnsfordeling" sub={funFacts.sexCount.U > 0 ? `+ ${funFacts.sexCount.U} ukjent` : undefined} />
                  )}
                  {funFacts.topMonth && (
                    <FunFactCard icon="🌸" value={funFacts.topMonth.month} label="Mest populære fødselsmåned" sub={`${funFacts.topMonth.count} personer`} />
                  )}
                  {funFacts.mostKids > 0 && (
                    <FunFactCard icon="👨‍👩‍👧‍👦" value={`${funFacts.mostKids} barn`} label="Flest barn i én familie" />
                  )}
                  {funFacts.firstNames?.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-4)', gridColumn: 'span 1' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: 20 }}>👤</span>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>Vanligste fornavn</span>
                      </div>
                      {funFacts.firstNames.map(({ name, count }) => (
                        <div key={name} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>{name}</span><span style={{ color: 'var(--color-text-muted)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {funFacts.lastNames?.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-4)', gridColumn: 'span 1' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: 20 }}>🏷️</span>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>Vanligste etternavn</span>
                      </div>
                      {funFacts.lastNames.map(({ name, count }) => (
                        <div key={name} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>{name}</span><span style={{ color: 'var(--color-text-muted)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
