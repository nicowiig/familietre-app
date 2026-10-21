import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { useFamilyGraph } from '../hooks/useFamilyGraph'
import { getDisplayTitle } from '../lib/titles'

const MAX_GEN = 30

/** BFS oppover: korteste vei fra meg til hver ane. Map<ancestorId, { gen, via }> der via er barnet på veien ned. */
function ancestorPaths(startId, parentMap) {
  const result = new Map()
  const queue = [[startId, 0]]
  while (queue.length) {
    const [id, gen] = queue.shift()
    if (gen >= MAX_GEN) continue
    for (const p of parentMap.get(id) ?? []) {
      if (!result.has(p)) {
        result.set(p, { gen: gen + 1, via: id })
        queue.push([p, gen + 1])
      }
    }
  }
  return result
}

/** Alle aner per generasjon, telt via alle veier (ikke bare korteste), uten dobbeltelling innen samme generasjon. */
function ancestorsPerGeneration(startId, parentMap) {
  const perGen = []
  let level = new Set([startId])
  for (let g = 1; g <= MAX_GEN && level.size; g++) {
    const next = new Set()
    for (const id of level) for (const p of parentMap.get(id) ?? []) next.add(p)
    if (!next.size) break
    perGen.push({ gen: g, known: next.size, possible: 2 ** g })
    level = next
  }
  return perGen
}

function shortName(info, id) {
  if (!info) return id
  const name = [info.givenName, info.surname].filter(Boolean).join(' ') || id
  const t = getDisplayTitle(id)
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)} ${name}` : name
}

function years(info) {
  if (!info) return ''
  if (info.birthYear && info.deathYear) return `${info.birthYear}–${info.deathYear}`
  if (info.birthYear) return `f. ${info.birthYear}`
  if (info.deathYear) return `d. ${info.deathYear}`
  return ''
}

const GEN_NAMES = ['', 'Foreldre', 'Besteforeldre', 'Oldeforeldre', 'Tippoldeforeldre', 'Tipp-tippoldeforeldre']

export function MinSlektPage() {
  const { personId: me } = useAuth()
  const { graph, loading } = useFamilyGraph()
  const [encyclopedic, setEncyclopedic] = useState(null) // Set<personId> med leksikonkilde

  const paths = useMemo(() => (graph && me ? ancestorPaths(me, graph.parentMap) : new Map()), [graph, me])
  const perGen = useMemo(() => (graph && me ? ancestorsPerGeneration(me, graph.parentMap) : []), [graph, me])

  // Aner med leksikonartikkel (Wikipedia, SNL, NBL, lex.dk) regnes som «kjente»
  useEffect(() => {
    if (!paths.size) return
    let cancelled = false
    async function load() {
      const ids = [...paths.keys()]
      const found = new Set()
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await supabase.from('person_sources').select('person_id, url')
          .in('person_id', ids.slice(i, i + 300))
          .or('url.ilike.%wikipedia.org%,url.ilike.%snl.no%,url.ilike.%nbl.snl.no%,url.ilike.%lex.dk%')
        ;(data || []).forEach(r => found.add(r.person_id))
      }
      if (!cancelled) setEncyclopedic(found)
    }
    load()
    return () => { cancelled = true }
  }, [paths])

  const notable = useMemo(() => {
    if (!graph) return []
    return [...paths.entries()]
      .filter(([id]) => getDisplayTitle(id) || encyclopedic?.has(id))
      .map(([id, p]) => ({ id, ...p, info: graph.infoMap.get(id) }))
      .sort((a, b) => a.gen - b.gen || (a.info?.birthYear || 0) - (b.info?.birthYear || 0))
  }, [paths, graph, encyclopedic])

  const oldest = useMemo(() => {
    if (!graph) return null
    let best = null
    for (const [id] of paths) {
      const y = graph.infoMap.get(id)?.birthYear
      if (y && (!best || y < best.y)) best = { id, y }
    }
    return best
  }, [paths, graph])

  function pathTo(id) {
    const chain = []
    let cur = id
    while (cur && cur !== me) {
      chain.push(cur)
      cur = paths.get(cur)?.via
    }
    return chain.reverse() // fra nærmeste ane til målet
  }

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Min slekt</h1>
          <p className="page-subtitle">Hvor langt tilbake treet ditt når, og hvordan du henger sammen med de kjente navnene i det.</p>
        </div>

        {!me ? (
          <p className="text-muted">Profilen din er ikke koblet til en person i treet ennå.</p>
        ) : loading || !graph ? (
          <LoadingSpinner text="Regner ut anetavlen…" />
        ) : (
          <>
            <section className="profile-section">
              <h2 className="profile-section-header">Anetavlen</h2>
              <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                {paths.size.toLocaleString('nb-NO')} kjente aner over {perGen.length} generasjoner
                {oldest && <> · eldste med kjent fødselsår: <Link to={`/person/${oldest.id}`}>{shortName(graph.infoMap.get(oldest.id), oldest.id)}</Link> (f. {oldest.y})</>}.
                {' '}Når samme ane dukker opp via flere linjer (aneavkorting), telles hun eller han én gang per generasjon.
              </p>
              <div className="pedigree-bars">
                {perGen.map(g => {
                  const pct = Math.min(100, (g.known / g.possible) * 100)
                  return (
                    <div key={g.gen} className="pedigree-row">
                      <span className="pedigree-label">{GEN_NAMES[g.gen] || `${g.gen}. generasjon`}</span>
                      <span className="pedigree-track"><span className="pedigree-fill" style={{ width: `${Math.max(pct, 0.5)}%` }} /></span>
                      <span className="pedigree-count">
                        {g.known.toLocaleString('nb-NO')} av {g.possible.toLocaleString('nb-NO')}
                        <span className="text-light"> · {pct >= 10 ? Math.round(pct) : pct >= 0.01 ? pct.toLocaleString('nb-NO', { maximumFractionDigits: pct >= 1 ? 1 : 2 }) : '< 0,01'} %</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="profile-section">
              <h2 className="profile-section-header">Din vei til kjente aner</h2>
              <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                Aner med kongelig, fyrstelig eller adelig tittel, eller med egen leksikonartikkel. Klikk for å se hele linjen ned til deg.
              </p>
              {encyclopedic === null && <LoadingSpinner text="Henter kilder…" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {notable.map(n => (
                  <details key={n.id} className="card notable-ancestor">
                    <summary>
                      <span className="notable-name">{shortName(n.info, n.id)}</span>
                      <span className="text-sm text-muted">{years(n.info)}</span>
                      <span className="notable-gen">{n.gen} ledd</span>
                    </summary>
                    <ol className="ancestor-path">
                      <li><Link to={`/person/${me}`}>Deg</Link></li>
                      {pathTo(n.id).map(id => (
                        <li key={id}>
                          <Link to={`/person/${id}`}>{shortName(graph.infoMap.get(id), id)}</Link>
                          <span className="text-light text-xs"> {years(graph.infoMap.get(id))}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  )
}
