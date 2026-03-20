import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { supabase } from '../supabase'

export function StatistikkPage() {
  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>Statistikk</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-10)' }}>
          Tall og trender fra familiearkivet
        </p>

        <OverviewStats />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)', marginTop: 'var(--space-8)' }}>
          <SexDistribution />
          <BirthDecades />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-8)', marginTop: 'var(--space-8)' }}>
          <TopSurnames />
          <TopBirthCities />
          <TopOccupations />
        </div>
      </div>
    </Layout>
  )
}

// ─── Overordnet statistikk ────────────────────────────────
function OverviewStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function load() {
      const [persons, families, bios, places, photos] = await Promise.all([
        supabase.from('persons').select('person_id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('families').select('family_id', { count: 'exact', head: true }),
        supabase.from('person_biography').select('person_id', { count: 'exact', head: true }),
        supabase.from('place_articles').select('id', { count: 'exact', head: true }),
        supabase.from('person_photos').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        persons:  persons.count  || 0,
        families: families.count || 0,
        bios:     bios.count     || 0,
        places:   places.count   || 0,
        photos:   photos.count   || 0,
      })
    }
    load()
  }, [])

  const items = stats ? [
    { value: stats.persons.toLocaleString('nb-NO'),  label: 'Personer' },
    { value: stats.families.toLocaleString('nb-NO'), label: 'Familier' },
    { value: stats.bios.toLocaleString('nb-NO'),     label: 'Biografier' },
    { value: stats.places.toLocaleString('nb-NO'),   label: 'Stedsartikler' },
    { value: stats.photos.toLocaleString('nb-NO'),   label: 'Bilder' },
  ] : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-4)' }}>
      {items.map(({ value, label }) => (
        <div key={label} className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Kjønnsfordeling ─────────────────────────────────────
function SexDistribution() {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('persons')
        .select('sex')
        .eq('is_deleted', false)
      if (!rows) return
      const counts = { M: 0, F: 0, U: 0 }
      rows.forEach(r => {
        if (r.sex === 'M') counts.M++
        else if (r.sex === 'F') counts.F++
        else counts.U++
      })
      setData(counts)
    }
    load()
  }, [])

  const total = data ? data.M + data.F + data.U : 0
  const bars = data ? [
    { label: 'Menn',   count: data.M, color: '#6b93c4' },
    { label: 'Kvinner', count: data.F, color: '#c46b8a' },
    { label: 'Ukjent', count: data.U, color: 'var(--color-border)' },
  ] : []

  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)' }}>Kjønnsfordeling</h3>
      {bars.map(({ label, count, color }) => (
        <div key={label} style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
            <span>{label}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{count.toLocaleString('nb-NO')} ({total ? Math.round(count / total * 100) : 0}%)</span>
          </div>
          <div style={{ height: 8, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${total ? count / total * 100 : 0}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Fødselsdekader ───────────────────────────────────────
function BirthDecades() {
  const [buckets, setBuckets] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('person_facts')
        .select('date_year')
        .eq('fact_type', 'BIRT')
        .not('date_year', 'is', null)
        .gte('date_year', 1500)
        .lte('date_year', 2030)
      if (!data) return

      const counts = {}
      data.forEach(r => {
        const decade = Math.floor(r.date_year / 50) * 50
        counts[decade] = (counts[decade] || 0) + 1
      })
      const sorted = Object.entries(counts)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([year, count]) => ({ label: `${year}–${Number(year) + 49}`, count }))
      setBuckets(sorted)
    }
    load()
  }, [])

  const max = Math.max(...buckets.map(b => b.count), 1)

  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)' }}>Fødsler per 50-årsperiode</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {buckets.map(({ label, count }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', width: 90, flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: 14, background: 'var(--color-bg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${count / max * 100}%`, background: 'var(--color-accent)', borderRadius: 3, opacity: 0.75, transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', width: 32, textAlign: 'right', flexShrink: 0 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Topp etternavn ───────────────────────────────────────
function TopSurnames() {
  const [items, setItems] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('person_names')
        .select('surname')
        .eq('is_preferred', true)
        .not('surname', 'is', null)
      if (!data) return
      const counts = {}
      data.forEach(r => { counts[r.surname] = (counts[r.surname] || 0) + 1 })
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12)
        .map(([name, count]) => ({ name, count }))
      setItems(sorted)
    }
    load()
  }, [])

  const max = items[0]?.count || 1

  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)' }}>Vanligste etternavn</h3>
      <TopList items={items.map(i => ({ label: i.name, count: i.count }))} max={max} />
    </div>
  )
}

// ─── Topp fødselsbyer ─────────────────────────────────────
function TopBirthCities() {
  const [items, setItems] = useState([])

  useEffect(() => {
    async function load() {
      // Hent både place_city og place_raw — de fleste har kun place_raw
      const { data } = await supabase
        .from('person_facts')
        .select('place_city, place_raw')
        .eq('fact_type', 'BIRT')
      if (!data) return
      const counts = {}
      data.forEach(r => {
        // Bruk place_city hvis satt, ellers trekk ut første del av place_raw
        const city = r.place_city || (r.place_raw ? r.place_raw.split(',')[0].trim() : null)
        if (city) counts[city] = (counts[city] || 0) + 1
      })
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12)
        .map(([name, count]) => ({ name, count }))
      setItems(sorted)
    }
    load()
  }, [])

  const max = items[0]?.count || 1

  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)' }}>Vanligste fødselssteder</h3>
      {items.length === 0
        ? <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Ingen stedsdata registrert.</p>
        : <TopList items={items.map(i => ({ label: i.name, count: i.count }))} max={max} />
      }
    </div>
  )
}

// ─── Topp yrker ───────────────────────────────────────────
function TopOccupations() {
  const [items, setItems] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('person_roles')
        .select('value')
        .eq('role_type', 'occupation')
        .not('value', 'is', null)
      if (!data) return
      const counts = {}
      data.forEach(r => {
        // Normaliser til lowercase for sammenligning
        const key = r.value.trim().toLowerCase()
        counts[key] = { count: (counts[key]?.count || 0) + 1, label: r.value.trim() }
      })
      const sorted = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
      setItems(sorted)
    }
    load()
  }, [])

  const max = items[0]?.count || 1

  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)' }}>Vanligste yrker</h3>
      {items.length === 0
        ? <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Ingen yrkesdata registrert.</p>
        : <TopList items={items.map(i => ({ label: i.label, count: i.count }))} max={max} />
      }
    </div>
  )
}

// ─── Felles listehjelper ──────────────────────────────────
function TopList({ items, max }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {items.map(({ label, count }, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', width: 16, flexShrink: 0, textAlign: 'right' }}>{i + 1}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 2 }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 4 }}>{count}</span>
            </div>
            <div style={{ height: 4, background: 'var(--color-bg)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${count / max * 100}%`, background: 'var(--color-accent)', borderRadius: 2, opacity: 0.6 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
