import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { LinkPreview } from '../components/LinkPreview'
import { getPreferredName, formatName } from '../lib/persons'
import { formatLifespan } from '../lib/dates'
import { AcquiredBadge, UnapprovedNote } from '../components/RoleInfo'
import { CATEGORY_LABELS } from '../lib/roles'

const LANG_LABELS = { da: 'dansk', de: 'tysk', en: 'engelsk', sv: 'svensk', la: 'latin' }

function yearOf(v) {
  const m = String(v || '').match(/\d{4}/)
  return m ? m[0] : null
}

export function RolePage() {
  const { id } = useParams()
  const roleId = Number(id)
  const [role, setRole]           = useState(null)
  const [children, setChildren]   = useState([])
  const [variants, setVariants]   = useState([])
  const [spellings, setSpellings] = useState([])
  const [holders, setHolders]     = useState([])
  const [includeSub, setIncludeSub] = useState(true)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [roleRes, childRes, variantRes, glossRes] = await Promise.all([
        supabase.from('role_catalog')
          .select('*, parent:parent_id(id, name), male:gender_variant_of(id, name)')
          .eq('id', roleId).maybeSingle(),
        supabase.from('role_catalog').select('id, name').eq('parent_id', roleId).order('name'),
        supabase.from('role_catalog').select('id, name').eq('gender_variant_of', roleId).order('name'),
        supabase.from('title_glossary').select('original, language').eq('role_id', roleId).order('original'),
      ])
      if (cancelled) return
      setRole(roleRes.data)
      setChildren(childRes.data || [])
      setVariants(variantRes.data || [])
      setSpellings(glossRes.data || [])

      const relatedIds = [roleId, ...(childRes.data || []).map(r => r.id), ...(variantRes.data || []).map(r => r.id)]
      const { data: rows } = await supabase
        .from('person_roles')
        .select('id, person_id, role_id, value, original_value, place, date_from, date_to, acquired_by')
        .in('role_id', relatedIds)
      const personIds = [...new Set((rows || []).map(r => r.person_id))]
      if (!personIds.length) { setHolders([]); setLoading(false); return }

      const [namesRes, factsRes, personsRes] = await Promise.all([
        supabase.from('person_names').select('person_id, given_name, middle_name, surname, is_preferred, name_type').in('person_id', personIds),
        supabase.from('person_facts').select('person_id, fact_type, date_year').in('person_id', personIds).in('fact_type', ['BIRT', 'DEAT']),
        supabase.from('persons').select('person_id, is_living, is_deleted').in('person_id', personIds),
      ])
      if (cancelled) return

      const namesBy = {}
      ;(namesRes.data || []).forEach(n => { (namesBy[n.person_id] ||= []).push(n) })
      const facts = {}
      ;(factsRes.data || []).forEach(f => {
        const o = (facts[f.person_id] ||= {})
        if (f.fact_type === 'BIRT' && f.date_year && !o.birth) o.birth = f.date_year
        if (f.fact_type === 'DEAT' && f.date_year && !o.death) o.death = f.date_year
      })
      const persons = {}
      ;(personsRes.data || []).forEach(p => { persons[p.person_id] = p })

      const byPerson = {}
      ;(rows || []).forEach(r => {
        if (persons[r.person_id]?.is_deleted) return
        ;(byPerson[r.person_id] ||= []).push(r)
      })
      const list = Object.entries(byPerson).map(([pid, roles]) => ({
        personId: pid,
        name: formatName(getPreferredName(namesBy[pid] || [])),
        birth: facts[pid]?.birth,
        death: facts[pid]?.death,
        isLiving: persons[pid]?.is_living,
        roles: roles.sort((a, b) => (yearOf(a.date_from) || 0) - (yearOf(b.date_from) || 0)),
      }))
      list.sort((a, b) => (a.birth || 9999) - (b.birth || 9999))
      setHolders(list)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [roleId])

  const visible = useMemo(() => {
    if (includeSub) return holders
    return holders
      .map(h => ({ ...h, roles: h.roles.filter(r => r.role_id === roleId) }))
      .filter(h => h.roles.length)
  }, [holders, includeSub, roleId])

  if (loading) return <Layout><LoadingSpinner fullPage /></Layout>
  if (!role) {
    return (
      <Layout>
        <div className="page-container">
          <p>Fant ikke rollen. <Link to="/roller">Tilbake til yrker og titler</Link></p>
        </div>
      </Layout>
    )
  }

  const meta = [CATEGORY_LABELS[role.category], role.social_group, role.period, role.context].filter(Boolean)
  const hasSub = children.length > 0 || variants.length > 0
  const span = visible.map(h => h.birth).filter(Boolean)

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: 820, paddingBottom: 'var(--space-16)' }}>
        <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
          <Link to="/roller">Yrker og titler</Link>
          {role.parent && <> › <Link to={`/rolle/${role.parent.id}`}>{role.parent.name}</Link></>}
        </p>
        <h1 style={{ marginBottom: 'var(--space-2)' }}>{role.name}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {meta.join(' · ')}
        </p>

        {role.description && (
          <div className="profile-section" style={{ marginBottom: 'var(--space-6)' }}>
            <h2 className="profile-section-header">Hva innebar rollen?</h2>
            <p style={{ lineHeight: 1.6, marginBottom: 'var(--space-2)' }}>{role.description}</p>
            <UnapprovedNote catalog={role} />
          </div>
        )}

        {(role.male || hasSub || spellings.length > 0) && (
          <div className="profile-section" style={{ marginBottom: 'var(--space-6)' }}>
            <h2 className="profile-section-header">Beslektede roller og skrivemåter</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              {role.male && <div>Hankjønnsform: <Link to={`/rolle/${role.male.id}`}>{role.male.name}</Link></div>}
              {variants.length > 0 && (
                <div>Hunkjønnsform: {variants.map((v, i) => <span key={v.id}>{i > 0 && ', '}<Link to={`/rolle/${v.id}`}>{v.name}</Link></span>)}</div>
              )}
              {children.length > 0 && (
                <div>Underroller: {children.map((c, i) => <span key={c.id}>{i > 0 && ', '}<Link to={`/rolle/${c.id}`}>{c.name}</Link></span>)}</div>
              )}
              {spellings.length > 0 && (
                <div>
                  Skrevet i kildene som:{' '}
                  {spellings.map((g, i) => (
                    <span key={g.original}>
                      {i > 0 && ', '}«{g.original}»{g.language && LANG_LABELS[g.language] ? ` (${LANG_LABELS[g.language]})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h2 className="profile-section-header" style={{ marginBottom: 0 }}>
              I familietreet ({visible.length})
            </h2>
            {hasSub && (
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={includeSub} onChange={e => setIncludeSub(e.target.checked)} />
                Ta med beslektede roller
              </label>
            )}
          </div>
          {span.length > 1 && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 var(--space-4)' }}>
              Født mellom {Math.min(...span)} og {Math.max(...span)}.
            </p>
          )}
          {visible.length === 0 && <p className="text-muted">Ingen personer i treet har denne rollen ennå.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
            {visible.map(h => (
              <div key={h.personId} style={{ borderLeft: '2px solid var(--color-border)', paddingLeft: 'var(--space-3)' }}>
                <div style={{ fontWeight: 600 }}>
                  <LinkPreview to={`/person/${h.personId}`}>{h.name || h.personId}</LinkPreview>
                  <span style={{ fontWeight: 400, color: 'var(--color-text-light)', fontSize: 'var(--text-sm)', marginLeft: 8 }}>
                    {formatLifespan(h.birth, h.death, h.isLiving)}
                  </span>
                </div>
                {h.roles.map(r => {
                  const period = [yearOf(r.date_from), yearOf(r.date_to)].filter(Boolean).join('–')
                  const showName = r.role_id !== roleId
                  const orig = r.original_value && r.original_value.toLowerCase() !== (r.value || '').toLowerCase()
                    ? r.original_value : null
                  return (
                    <div key={r.id} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      {showName && <Link to={`/rolle/${r.role_id}`}>{r.value}</Link>}
                      {[r.place, period].filter(Boolean).join(' · ') || (!showName && '—')}
                      <AcquiredBadge value={r.acquired_by} />
                      {orig && <span style={{ fontStyle: 'italic', color: 'var(--color-text-light)', fontSize: 'var(--text-xs)' }}>i kilden: «{orig}»</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
