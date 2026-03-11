import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { PersonCard } from '../components/PersonCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { getPreferredName, formatName } from '../lib/persons'
import { formatLifespan } from '../lib/dates'

const PAGE_SIZE = 20

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''

  const [input, setInput]     = useState(query)
  const [results, setResults] = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage]       = useState(0)
  const debounceRef = useRef()

  useEffect(() => {
    setInput(query)
    setPage(0)
    if (query) doSearch(query, 0)
    else { setResults([]); setTotal(0) }
  }, [query])

  async function doSearch(q, pageNum = 0) {
    if (!q.trim()) return
    setLoading(true)
    try {
      // Søk i person_names (dekker alle navneregistreringer inkl. kallenavn)
      const { data: nameMatches } = await supabase
        .from('person_names')
        .select('person_id, given_name, middle_name, surname, nickname, is_preferred, name_type')
        .or(
          `given_name.ilike.%${q}%,` +
          `surname.ilike.%${q}%,` +
          `middle_name.ilike.%${q}%,` +
          `nickname.ilike.%${q}%`
        )
        .limit(200)

      if (!nameMatches?.length) {
        setResults([])
        setTotal(0)
        return
      }

      // Samle unike person-IDer (behold alle navnematcher for vising)
      const idToNames = {}
      nameMatches.forEach(n => {
        if (!idToNames[n.person_id]) idToNames[n.person_id] = []
        idToNames[n.person_id].push(n)
      })

      const uniqueIds = Object.keys(idToNames)
      setTotal(uniqueIds.length)

      const pageIds = uniqueIds.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE)

      // Hent persons + fødsel/død
      const [personsRes, factsRes] = await Promise.all([
        supabase.from('persons').select('*').in('person_id', pageIds).eq('is_deleted', false),
        supabase.from('person_facts')
          .select('person_id, fact_type, date_year, place_city, place_raw')
          .in('person_id', pageIds)
          .in('fact_type', ['BIRT', 'DEAT']),
      ])

      const persons  = personsRes.data || []
      const factsMap = {}
      ;(factsRes.data || []).forEach(f => {
        if (!factsMap[f.person_id]) factsMap[f.person_id] = []
        factsMap[f.person_id].push(f)
      })

      // Bygg resultatobjekter
      const items = persons.map(p => {
        const personFacts  = factsMap[p.person_id] || []
        const birth = personFacts.find(f => f.fact_type === 'BIRT')
        const death = personFacts.find(f => f.fact_type === 'DEAT')
        const preferred = getPreferredName(idToNames[p.person_id])
        // Finn alle andre navn som matchet søket (for sub-visning)
        const matchedNames = idToNames[p.person_id] || []

        return {
          person: p,
          preferred,
          birthYear:  birth?.date_year,
          deathYear:  death?.date_year,
          birthPlace: birth?.place_city || birth?.place_raw,
          matchedNames,
        }
      })

      // Sorter etter preferred navn
      items.sort((a, b) => formatName(a.preferred).localeCompare(formatName(b.preferred), 'nb'))

      if (pageNum === 0) setResults(items)
      else setResults(prev => [...prev, ...items])
      setPage(pageNum)
    } finally {
      setLoading(false)
    }
  }

  function handleInput(e) {
    const val = e.target.value
    setInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setParams(val.trim() ? { q: val.trim() } : {})
    }, 300)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (input.trim()) setParams({ q: input.trim() })
  }

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>

        {/* Søkefelt */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-8)', maxWidth: 480 }}>
          <div className="search-wrapper">
            <span className="search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="search"
              placeholder="Søk etter fornavn, etternavn, kallenavn…"
              value={input}
              onChange={handleInput}
              autoFocus
              style={{ fontSize: 'var(--text-md)', height: 52, paddingLeft: 'var(--space-10)' }}
            />
          </div>
        </form>

        {/* Resultater */}
        {loading && !results.length ? (
          <LoadingSpinner text="Søker…" />
        ) : query && !loading && results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
            <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)' }}>
              Ingen treff på «{query}»
            </p>
            <p className="text-sm text-muted mt-4">
              Prøv et annet navn eller stavemåte.
            </p>
          </div>
        ) : results.length > 0 ? (
          <>
            <p className="text-sm text-muted mb-6">
              {total} {total === 1 ? 'treff' : 'treff'} på «{query}»
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {results.map(r => (
                <SearchResultItem key={r.person.person_id} result={r} query={query} />
              ))}
            </div>

            {/* Last inn flere */}
            {(page + 1) * PAGE_SIZE < total && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => doSearch(query, page + 1)}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner size="sm" /> : 'Last inn flere'}
                </button>
              </div>
            )}
          </>
        ) : !query ? (
          <BrowseAll />
        ) : null}
      </div>
    </Layout>
  )
}

function SearchResultItem({ result, query }) {
  const { person, preferred, birthYear, deathYear, birthPlace, matchedNames } = result
  const mainName = formatName(preferred)
  const lifespan = formatLifespan(birthYear, deathYear, person.is_living)

  // Finn kallenavn / alternative navn som matchet
  const altNames = matchedNames
    .filter(n => {
      const nm = (n.given_name + ' ' + n.surname).toLowerCase()
      return !n.is_preferred && (n.nickname || nm.includes(query.toLowerCase()))
    })
    .map(n => n.nickname || formatName(n))
    .filter(Boolean)
    .slice(0, 2)

  return (
    <Link
      to={`/person/${person.person_id}`}
      style={{ textDecoration: 'none' }}
    >
      <div className="person-card">
        <PersonSilhouette sex={person.sex} />
        <div className="person-card-info">
          <div className="person-card-name">
            <HighlightMatch text={mainName} query={query} />
          </div>
          <div className="person-card-years">
            {lifespan}
            {birthPlace && <span style={{ marginLeft: 8, color: 'var(--color-text-light)' }}>· {birthPlace}</span>}
          </div>
          {altNames.length > 0 && (
            <div className="person-card-place" style={{ fontStyle: 'italic' }}>
              Også kjent som: {altNames.join(', ')}
            </div>
          )}
        </div>
        <ArrowIcon />
      </div>
    </Link>
  )
}

function PersonSilhouette({ sex }) {
  return (
    <div className="person-card-photo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-border-light)' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#c8b89a">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-border)" strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}

function HighlightMatch({ text, query }) {
  if (!query || !text) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(122,58,26,0.15)', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/* ===== Bla gjennom alle ===== */
function BrowseAll() {
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: names } = await supabase
        .from('person_names')
        .select('person_id, given_name, surname, middle_name, is_preferred')
        .eq('is_preferred', true)
        .order('surname')
        .limit(50)

      if (names) {
        setPersons(names)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-5)' }}>
        Bla gjennom treet
      </h3>
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {persons.map(n => (
            <Link
              key={n.person_id}
              to={`/person/${n.person_id}`}
              className="person-card"
              style={{ padding: 'var(--space-3) var(--space-4)' }}
            >
              <div className="person-card-info">
                <div className="person-card-name">{formatName(n)}</div>
              </div>
              <ArrowIcon />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
