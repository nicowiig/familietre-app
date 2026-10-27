import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TILE_URL, TILE_ATTRIBUTION, TILE_MAX_ZOOM } from '../lib/mapTiles'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../supabase'
import { formatName } from '../lib/persons'
import { SilhouetteSvg } from './PersonCard'

// «Utforsk mer» for nyhetssaker: personkort gruppert etter group_label + kart over steder.
export function ArticleExplore({ articleId, persons }) {
  const [people, setPeople]       = useState([])
  const [locations, setLocations] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const ids = persons.map(p => p.person_id)
      const [namesRes, factsRes, photosRes, locRes] = await Promise.all([
        ids.length ? supabase.from('person_names')
          .select('person_id, given_name, epithet, middle_name, surname, prefix, is_preferred').in('person_id', ids) : { data: [] },
        ids.length ? supabase.from('person_facts')
          .select('person_id, fact_type, date_year').in('person_id', ids).in('fact_type', ['BIRT', 'DEAT']) : { data: [] },
        ids.length ? supabase.from('person_photos')
          .select('person_id, drive_url').in('person_id', ids).eq('is_primary', true) : { data: [] },
        supabase.from('place_article_locations')
          .select('id, label, note, sort_order, addresses(id, coordinates_lat, coordinates_lng, name_display, street_name, house_number, house_letter)')
          .eq('article_id', articleId)
          .order('sort_order'),
      ])

      const names = {}
      ;(namesRes.data || []).forEach(n => { if (!names[n.person_id] || n.is_preferred) names[n.person_id] = n })
      const years = {}
      ;(factsRes.data || []).forEach(f => {
        years[f.person_id] = years[f.person_id] || {}
        if (f.date_year && !years[f.person_id][f.fact_type]) years[f.person_id][f.fact_type] = f.date_year
      })
      const photoPaths = {}
      ;(photosRes.data || []).forEach(p => { photoPaths[p.person_id] = p.drive_url })
      const paths = Object.values(photoPaths).filter(Boolean)
      const signed = {}
      if (paths.length) {
        const { data } = await supabase.storage.from('person-photos').createSignedUrls(paths, 3600)
        ;(data || []).forEach(s => { signed[s.path] = s.signedUrl })
      }

      if (cancelled) return
      setPeople(persons.map(p => ({
        ...p,
        name: names[p.person_id] ? formatName(names[p.person_id]) : p.person_id,
        birth: years[p.person_id]?.BIRT,
        death: years[p.person_id]?.DEAT,
        photo: signed[photoPaths[p.person_id]] || null,
      })))
      setLocations((locRes.data || [])
        .map(l => ({
          ...l,
          latlng: [parseFloat(l.addresses?.coordinates_lat), parseFloat(l.addresses?.coordinates_lng)],
        }))
        .filter(l => !isNaN(l.latlng[0]) && !isNaN(l.latlng[1])))
    }
    load()
    return () => { cancelled = true }
  }, [articleId, persons])

  // Grupper personer
  const groups = []
  const byLabel = {}
  ;[...people]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach(p => {
      const label = p.group_label || 'Personer i saken'
      if (!byLabel[label]) { byLabel[label] = []; groups.push(label) }
      byLabel[label].push(p)
    })

  const center = locations.length
    ? [
        locations.reduce((s, l) => s + l.latlng[0], 0) / locations.length,
        locations.reduce((s, l) => s + l.latlng[1], 0) / locations.length,
      ]
    : null

  return (
    <>
      {locations.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
          <h2 className="profile-section-header" style={{ marginBottom: 'var(--space-3)' }}>Stedene i saken</h2>
          <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <MapContainer center={center} zoom={15} style={{ height: 380, width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                attribution={TILE_ATTRIBUTION}
                url={TILE_URL}
                maxZoom={TILE_MAX_ZOOM}
              />
              {locations.map(l => (
                <CircleMarker
                  key={l.id}
                  center={l.latlng}
                  radius={8}
                  pathOptions={{ color: '#c09a5a', fillColor: '#c09a5a', fillOpacity: 0.75, weight: 1.5 }}
                >
                  <Popup>
                    <div style={{ minWidth: 150 }}>
                      <strong style={{ display: 'block', marginBottom: 4 }}>{l.label || l.addresses?.name_display}</strong>
                      {l.note && <span style={{ fontSize: 12, color: '#666' }}>{l.note}</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <ol style={{ margin: 'var(--space-3) 0 0', paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', columns: '2 260px' }}>
            {locations.map(l => (
              <li key={l.id} style={{ breakInside: 'avoid', marginBottom: 2 }}>
                <span style={{ color: 'var(--color-text)' }}>{l.label}</span>{l.note ? ` – ${l.note}` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}

      {groups.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
          <h2 className="profile-section-header" style={{ marginBottom: 'var(--space-3)' }}>Utforsk personene</h2>
          {groups.map(label => (
            <div key={label} style={{ marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-accent)', marginBottom: 'var(--space-2)' }}>
                {label}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-2)' }}>
                {byLabel[label].map(p => (
                  <Link
                    key={p.id ?? p.person_id}
                    to={`/person/${p.person_id}`}
                    style={{
                      display: 'flex', gap: 'var(--space-3)', alignItems: 'center',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                      background: 'var(--color-bg)', textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    {p.photo
                      ? <img src={p.photo} alt={p.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><SilhouetteSvg size={26} /></div>}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', lineHeight: 1.3 }}>{p.name}</div>
                      {(p.birth || p.death) && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
                          {p.birth || '?'}–{p.death || ''}
                        </div>
                      )}
                      {p.role_note && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.35, marginTop: 2 }}>{p.role_note}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
