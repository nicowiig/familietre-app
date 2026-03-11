import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { getPreferredName, formatName } from '../lib/persons'
import { formatLifespan } from '../lib/dates'

export function BranchDetailPage() {
  const { id } = useParams()
  const { personId: myPersonId } = useAuth()
  const [branch, setBranch]   = useState(null)
  const [members, setMembers] = useState([])
  const [relation, setRelation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [branchRes, relRes] = await Promise.all([
        supabase.from('family_branches').select('*, family_branch_sources(*)').eq('id', id).maybeSingle(),
        myPersonId
          ? supabase.from('branch_user_relations')
              .select('relation_text, path_description, path_length, connecting_person_id')
              .eq('branch_id', id)
              .eq('user_person_id', myPersonId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setBranch(branchRes.data)
      if (relRes.data) setRelation(relRes.data)

      // Hent alle personer med dette etternavnet
      if (branchRes.data?.surname) {
        const { data: names } = await supabase
          .from('person_names')
          .select('person_id, given_name, surname, middle_name, is_preferred')
          .ilike('surname', branchRes.data.surname)

        if (names?.length) {
          const ids = [...new Set(names.map(n => n.person_id))]
          const [personsRes, factsRes] = await Promise.all([
            supabase.from('persons').select('*').in('person_id', ids).eq('is_deleted', false),
            supabase.from('person_facts').select('person_id, fact_type, date_year')
              .in('person_id', ids).in('fact_type', ['BIRT', 'DEAT']),
          ])

          const nameMap = {}
          names.forEach(n => { if (!nameMap[n.person_id] || n.is_preferred) nameMap[n.person_id] = n })
          const factsMap = {}
          ;(factsRes.data || []).forEach(f => {
            if (!factsMap[f.person_id]) factsMap[f.person_id] = {}
            if (f.fact_type === 'BIRT') factsMap[f.person_id].birth = f.date_year
            if (f.fact_type === 'DEAT') factsMap[f.person_id].death = f.date_year
          })

          const items = (personsRes.data || []).map(p => ({
            person: p,
            name: nameMap[p.person_id],
            birthYear: factsMap[p.person_id]?.birth,
            deathYear: factsMap[p.person_id]?.death,
          }))

          items.sort((a, b) => {
            const ay = a.birthYear || 9999
            const by = b.birthYear || 9999
            return ay - by
          })

          setMembers(items)
        }
      }

      setLoading(false)
    }
    load()
  }, [id, myPersonId])

  if (loading) return <Layout><LoadingSpinner fullPage /></Layout>
  if (!branch) return (
    <Layout>
      <div className="page-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <p>Slektsgren ikke funnet.</p>
        <Link to="/grener" className="btn btn-secondary mt-6">Tilbake</Link>
      </div>
    </Layout>
  )

  const period = [branch.period_from, branch.period_to].filter(Boolean).join(' – ')

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>

        {/* Navigasjon */}
        <Link to="/grener" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 'var(--space-6)' }}>
          ← Alle slektsgrener
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-10)', alignItems: 'start' }}>
          <div>
            {/* Tittel */}
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-2)' }}>
              {branch.display_name || branch.surname}
            </h1>
            {period && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 'var(--space-4)' }}>
                {period}
              </p>
            )}

            {/* Din relasjon */}
            {relation?.relation_text && (
              <div className="alert alert-info mb-6">
                <strong>Din tilknytning:</strong> {relation.relation_text}
                {relation.path_description && (
                  <p style={{ marginTop: 4, fontSize: 'var(--text-sm)' }}>{relation.path_description}</p>
                )}
              </div>
            )}

            {/* Beskrivelse */}
            {branch.description && (
              <div className="profile-section">
                <div className="profile-biography">
                  {branch.description.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            )}

            {/* Kjente medlemmer */}
            {branch.notable_members && (
              <div className="profile-section">
                <h2 className="profile-section-header">Kjente medlemmer</h2>
                <p>{branch.notable_members}</p>
              </div>
            )}

            {/* Alle medlemmer */}
            {members.length > 0 && (
              <div className="profile-section">
                <h2 className="profile-section-header">
                  {members.length} person{members.length !== 1 ? 'er' : ''} i treet
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {members.map(m => (
                    <Link
                      key={m.person.person_id}
                      to={`/person/${m.person.person_id}`}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', color: 'var(--color-text)', textDecoration: 'none', borderBottom: '1px solid var(--color-border-light)' }}
                    >
                      <span style={{ fontWeight: 500 }}>{formatName(m.name)}</span>
                      <span className="text-sm text-muted">
                        {formatLifespan(m.birthYear, m.deathYear, m.person.is_living)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div className="card">
              <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)' }}>Om grenen</h4>
              {branch.origin_place && (
                <div className="fact-item mb-4">
                  <span className="fact-label">Opprinnelse</span>
                  <span className="fact-value">
                    {branch.origin_place}
                    {branch.origin_country && ` · ${branch.origin_country}`}
                  </span>
                </div>
              )}
              {period && (
                <div className="fact-item mb-4">
                  <span className="fact-label">Periode</span>
                  <span className="fact-value">{period}</span>
                </div>
              )}
              <div className="fact-item">
                <span className="fact-label">Antall i treet</span>
                <span className="fact-value">{members.length}</span>
              </div>
            </div>

            {/* Kildelenker */}
            {branch.family_branch_sources?.length > 0 && (
              <div className="card">
                <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)' }}>Kilder</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {branch.family_branch_sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                    >
                      <span style={{ fontSize: 10, background: 'var(--color-accent)', color: '#fff', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
                        {s.source_type?.toUpperCase() || 'URL'}
                      </span>
                      {s.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
