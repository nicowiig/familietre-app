import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('family_branches')
        .select('*, family_branch_sources(*)')
        .order('surname')
      setBranches(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Slektsgrener</h1>
          <p className="page-subtitle">
            Utforsk familielinjene i treet — fra norske lokalslekter til europeiske fyrstehus.
          </p>
        </div>

        {loading ? (
          <LoadingSpinner text="Laster slektsgrener…" />
        ) : (
          <div className="cards-grid">
            {branches.map(b => (
              <BranchCard key={b.id} branch={b} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function BranchCard({ branch }) {
  const period = [branch.period_from, branch.period_to].filter(Boolean).join(' – ')

  return (
    <Link to={`/grener/${branch.id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ height: '100%', transition: 'all 0.15s', cursor: 'pointer' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--color-accent)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = 'var(--shadow)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = ''
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = ''
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>
          {branch.display_name || branch.surname}
        </h3>
        {period && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 'var(--space-3)' }}>
            {period}
          </p>
        )}
        {branch.origin_place && (
          <p className="text-sm text-muted mb-2">
            {branch.origin_place}
            {branch.origin_country && branch.origin_country !== branch.origin_place && ` · ${branch.origin_country}`}
          </p>
        )}
        {branch.description && (
          <p className="text-sm text-muted" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {branch.description}
          </p>
        )}
      </div>
    </Link>
  )
}
