import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'

const PAGE_SIZE = 50

const TABLE_LABELS = {
  persons:              'Person',
  person_names:         'Navn',
  person_facts:         'Hendelse',
  person_biography:     'Biografi',
  person_roles:         'Rolle',
  person_work_experience: 'Arbeidserfaring',
  person_sources:       'Kilde',
  address_periods:      'Adresse',
}

const CHANGE_TYPE_META = {
  insert: { label: 'Lagt til',   bg: '#dcfce7', text: '#166534' },
  update: { label: 'Oppdatert',  bg: '#e0f2fe', text: '#0369a1' },
  delete: { label: 'Slettet',    bg: '#fee2e2', text: '#991b1b' },
}

const USER_NAMES = {
  'nicowiig@gmail.com':          'Nicolay Wiig',
  'tallberg.marlene@gmail.com':  'Marlene Tallberg Wiig',
  'njwiig@gmail.com':            'njwiig',
  'sjokoladekake54@gmail.com':   'Gustav Wiig',
  'jontallbe@gmail.com':         'Jon Tallberg',
  'mamsemoren@gmail.com':        'Anne Wiig',
}

function displayUser(changedBy) {
  if (!changedBy || changedBy === 'script') return 'Nicolay Wiig (script)'
  return USER_NAMES[changedBy] || changedBy
}

function fmtGedcomDate(str) {
  if (!str) return str
  const M = { JAN:'januar', FEB:'februar', MAR:'mars', APR:'april', MAY:'mai', JUN:'juni',
              JUL:'juli', AUG:'august', SEP:'september', OCT:'oktober', NOV:'november', DEC:'desember' }
  return str.replace(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/g,
    (_, d, m, y) => `${parseInt(d)}. ${M[m] || m} ${y}`)
}

function fmtRelTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'akkurat nå'
  if (mins < 60)  return `${mins} min siden`
  if (hours < 24) return `${hours} t siden`
  if (days < 7)   return `${days} dager siden`
  return new Date(ts).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDayHeader(ts) {
  const d = new Date(ts)
  const today    = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  d.setHours(0,0,0,0)
  if (d.getTime() === today.getTime())     return 'I dag'
  if (d.getTime() === yesterday.getTime()) return 'I går'
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function entryDetail(row) {
  const parts = []
  if (row.field_name) parts.push(row.field_name)
  if (row.old_value || row.new_value) {
    const from = row.old_value ? fmtGedcomDate(row.old_value) : null
    const to   = row.new_value ? fmtGedcomDate(row.new_value) : null
    if (from && to) parts.push(`«${from}» → «${to}»`)
    else if (to)    parts.push(`«${to}»`)
    else if (from)  parts.push(`«${from}»`)
  }
  if (row.note) parts.push(row.note)
  return parts.join(' · ') || null
}

export function ChangelogPage() {
  const [rows,       setRows]       = useState([])
  const [nameMap,    setNameMap]    = useState({})
  const [loading,    setLoading]    = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,    setHasMore]    = useState(false)
  const [offset,     setOffset]     = useState(0)
  const [filterType, setFilterType] = useState(null)   // insert | update | delete
  const [filterTable, setFilterTable] = useState(null) // table_name value

  async function fetchNames(personIds) {
    if (!personIds.length) return {}
    const { data } = await supabase
      .from('person_names')
      .select('person_id, given_name, surname, is_preferred')
      .in('person_id', personIds)
      .eq('is_preferred', true)
    const map = {}
    for (const n of (data || [])) {
      map[n.person_id] = [n.given_name, n.surname].filter(Boolean).join(' ')
    }
    return map
  }

  async function load(reset = false) {
    const currentOffset = reset ? 0 : offset
    if (reset) setLoading(true)
    else setLoadingMore(true)

    let q = supabase
      .from('person_audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1)

    if (filterType)  q = q.eq('change_type', filterType)
    if (filterTable) q = q.eq('table_name', filterTable)

    const { data } = await q

    const newRows = data || []
    const ids = [...new Set(newRows.map(r => r.person_id))]
    const names = await fetchNames(ids)

    setNameMap(prev => ({ ...prev, ...names }))
    setRows(prev => reset ? newRows : [...prev, ...newRows])
    setOffset(currentOffset + newRows.length)
    setHasMore(newRows.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    load(true)
  }, [filterType, filterTable])  // eslint-disable-line react-hooks/exhaustive-deps

  // Grupper rader per dag
  function groupByDay(rows) {
    const groups = []
    let currentDay = null
    for (const row of rows) {
      const day = new Date(row.changed_at).toDateString()
      if (day !== currentDay) {
        currentDay = day
        groups.push({ day, ts: row.changed_at, entries: [] })
      }
      groups[groups.length - 1].entries.push(row)
    }
    return groups
  }

  const groups = groupByDay(rows)
  const allTables = [...new Set(rows.map(r => r.table_name).filter(Boolean))]

  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Endringslogg</h1>
          <p className="page-subtitle">Siste oppdateringer i familiearkivet.</p>
        </div>

        {/* Filter-chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {/* Change type */}
          {Object.entries(CHANGE_TYPE_META).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => setFilterType(prev => prev === type ? null : type)}
              style={{
                fontSize: 'var(--text-xs)', fontWeight: 600, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', border: '1px solid',
                background:   filterType === type ? meta.bg   : 'transparent',
                color:        filterType === type ? meta.text : 'var(--color-text-muted)',
                borderColor:  filterType === type ? meta.text : 'var(--color-border)',
                transition: 'all 0.15s',
              }}
            >
              {meta.label}
            </button>
          ))}
          {/* Separator */}
          {allTables.length > 0 && <span style={{ width: 1, background: 'var(--color-border)', margin: '0 4px' }} />}
          {/* Table filter */}
          {allTables.map(t => (
            <button
              key={t}
              onClick={() => setFilterTable(prev => prev === t ? null : t)}
              style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', border: '1px solid',
                background:  filterTable === t ? 'rgba(192,154,90,0.15)' : 'transparent',
                color:       filterTable === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
                borderColor: filterTable === t ? 'var(--color-accent)' : 'var(--color-border)',
                transition: 'all 0.15s',
              }}
            >
              {TABLE_LABELS[t] || t}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner text="Laster endringslogg…" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">Ingen endringer funnet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            {groups.map(group => (
              <div key={group.day}>
                {/* Dagsoverskrift */}
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--color-text-muted)',
                  marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  {fmtDayHeader(group.ts)}
                </div>

                {/* Entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {group.entries.map(row => {
                    const meta   = CHANGE_TYPE_META[row.change_type] || CHANGE_TYPE_META.update
                    const table  = TABLE_LABELS[row.table_name] || row.table_name
                    const name   = nameMap[row.person_id]
                    const detail = entryDetail(row)

                    return (
                      <div key={row.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                      }}>
                        {/* Change type chip */}
                        <span style={{
                          flexShrink: 0, fontSize: 'var(--text-xs)', fontWeight: 600,
                          padding: '2px 8px', borderRadius: 99,
                          background: meta.bg, color: meta.text,
                          marginTop: 2,
                        }}>
                          {meta.label}
                        </span>

                        {/* Main text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              {displayUser(row.changed_by)}
                            </span>
                            {name && (
                              <>
                                <span style={{ color: 'var(--color-text-muted)' }}> · </span>
                                <Link
                                  to={`/person/${row.person_id}`}
                                  style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}
                                >
                                  {name}
                                </Link>
                              </>
                            )}
                            {table && (
                              <span style={{ color: 'var(--color-text-muted)' }}> · {table}</span>
                            )}
                          </div>
                          {detail && (
                            <div style={{
                              fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                              marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {detail}
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        <span style={{
                          flexShrink: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                          marginTop: 2,
                        }}>
                          {fmtRelTime(row.changed_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Last mer */}
            {hasMore && (
              <button
                onClick={() => load(false)}
                disabled={loadingMore}
                style={{
                  alignSelf: 'center', padding: '8px 24px', borderRadius: 99,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-muted)',
                }}
              >
                {loadingMore ? 'Laster…' : 'Last flere'}
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
