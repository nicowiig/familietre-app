import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Link } from 'react-router-dom'

export function AdminPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('tilganger')

  if (!isAdmin) return (
    <Layout>
      <div className="page-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)' }}>Ingen tilgang</h2>
        <p className="text-muted mt-4">Kun for administratorer.</p>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <div className="page-header">
          <h1 className="page-title">Administrasjon</h1>
        </div>

        {/* Faner */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)', borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
          {[
            { id: 'tilganger', label: 'Tilgangsforespørsler' },
            { id: 'rettelser', label: 'Innsendte rettelser' },
            { id: 'datakvalitet', label: 'Datakvalitet' },
          ].map(t => (
            <button
              key={t.id}
              className="btn btn-ghost"
              onClick={() => setTab(t.id)}
              style={{
                borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                borderRadius: 0,
                color: tab === t.id ? 'var(--color-accent)' : undefined,
                fontWeight: tab === t.id ? 600 : undefined,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'tilganger' && <AccessRequestsTab />}
        {tab === 'datakvalitet' && <DataQualityTab />}
        {tab === 'rettelser' && (
          <div className="text-muted text-center" style={{ padding: 'var(--space-10)' }}>
            <p>Ingen innsendte rettelser ennå.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

function AccessRequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)

  async function load() {
    const { data } = await supabase
      .from('familietre_tilganger')
      .select('*')
      .order('requested_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handle(id, status) {
    await supabase
      .from('familietre_tilganger')
      .update({ status, handled_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  if (loading) return <LoadingSpinner text="Laster forespørsler…" />

  if (requests.length === 0) return (
    <p className="text-muted text-center" style={{ padding: 'var(--space-10)' }}>
      Ingen forespørsler.
    </p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {requests.map(r => (
        <div key={r.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{r.display_name || r.email}</div>
              <div className="text-sm text-muted">{r.email}</div>
              {r.message && <p className="text-sm mt-2" style={{ fontStyle: 'italic' }}>«{r.message}»</p>}
              <div className="text-xs text-muted mt-2">
                Sendt: {r.requested_at ? new Date(r.requested_at).toLocaleString('nb-NO') : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end', flexShrink: 0 }}>
              <span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handle(r.id, 'approved')}
                  >
                    Godkjenn
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-error)' }}
                    onClick={() => handle(r.id, 'rejected')}
                  >
                    Avvis
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const STATUS_LABELS = {
  pending:  'Venter',
  approved: 'Godkjent',
  rejected: 'Avvist',
}

function DataQualityTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        personsRes, withBioRes, withPhotoRes
      ] = await Promise.all([
        supabase.from('persons').select('person_id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('person_biography').select('person_id', { count: 'exact', head: true }).eq('is_approved', true),
        supabase.from('person_photos').select('person_id', { count: 'exact', head: true }).eq('is_primary', true),
      ])

      setStats({
        total:     personsRes.count || 0,
        withBio:   withBioRes.count || 0,
        withPhoto: withPhotoRes.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />
  if (!stats) return null

  const bioPct   = Math.round((stats.withBio   / stats.total) * 100)
  const photoPct = Math.round((stats.withPhoto / stats.total) * 100)

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-6)' }}>Datakompletthetsrapport</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-5)' }}>
        <StatCard label="Totalt antall personer" value={stats.total} />
        <StatCard label="Med godkjent biografi" value={stats.withBio} total={stats.total} pct={bioPct} />
        <StatCard label="Med primærbilde" value={stats.withPhoto} total={stats.total} pct={photoPct} />
      </div>
    </div>
  )
}

function StatCard({ label, value, pct }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
        {pct !== undefined ? `${pct}%` : value.toLocaleString('nb-NO')}
      </div>
      <div className="text-sm text-muted mt-2">{label}</div>
      {pct !== undefined && (
        <div style={{ marginTop: 8, background: 'var(--color-border-light)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, background: 'var(--color-accent)', height: '100%', borderRadius: 4 }} />
        </div>
      )}
    </div>
  )
}
