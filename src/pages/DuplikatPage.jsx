import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'

function buildDigitalarkivetUrl(name, birthYear) {
  if (!name) return null
  const params = new URLSearchParams()
  if (name.given_name) params.set('fornavn', name.given_name)
  if (name.surname)    params.set('etternavn', name.surname)
  if (birthYear)       params.set('foedselsaar', String(birthYear))
  return `https://www.digitalarkivet.no/search/persons/advanced?${params.toString()}`
}

async function loadPerson(id) {
  const [
    { data: person },
    { data: names },
    { data: facts },
    { data: bio },
    { data: photos },
    { data: roles },
    { data: addrPeriods },
    { data: sources },
  ] = await Promise.all([
    supabase.from('persons').select('person_id, sex, is_living').eq('person_id', id).maybeSingle(),
    supabase.from('person_names').select('*').eq('person_id', id).order('is_preferred', { ascending: false }),
    supabase.from('person_facts').select('*').eq('person_id', id).in('fact_type', ['BIRT', 'DEAT', 'birth', 'death', 'BIRTH', 'DEATH']),
    supabase.from('person_biography').select('*').eq('person_id', id).maybeSingle(),
    supabase.from('person_photos').select('id, person_id, drive_url, is_primary, photo_order').eq('person_id', id),
    supabase.from('person_roles').select('id, person_id').eq('person_id', id),
    supabase.from('address_periods').select('id, entity_id').eq('entity_type', 'person').eq('entity_id', id),
    supabase.from('person_sources').select('id, person_id').eq('person_id', id),
  ])
  const preferred = (names || []).find(n => n.is_preferred) || null
  const upType = t => (t || '').toUpperCase()
  const birth = (facts || []).find(f => upType(f.fact_type) === 'BIRT' || upType(f.fact_type) === 'BIRTH') || null
  const death = (facts || []).find(f => upType(f.fact_type) === 'DEAT' || upType(f.fact_type) === 'DEATH') || null
  const primaryPhoto = (photos || []).find(p => p.is_primary) || null

  return {
    person,
    names:       names || [],
    facts:       facts || [],
    bio:         bio || null,
    photos:      photos || [],
    photoCount:  (photos || []).length,
    roleCount:   (roles || []).length,
    addrCount:   (addrPeriods || []).length,
    sourceCount: (sources || []).length,
    preferred,
    birth,
    death,
    primaryPhoto,
    allNames:    names || [],
    allFacts:    facts || [],
    allAddrs:    addrPeriods || [],
    allRoles:    roles || [],
    allPhotos:   photos || [],
    allSources:  sources || [],
  }
}

function PersonColumn({ data, label }) {
  const { person, preferred, birth, death, bio, photoCount, roleCount, addrCount, sourceCount } = data
  const fullName = preferred
    ? [preferred.given_name, preferred.middle_name, preferred.surname].filter(Boolean).join(' ')
    : person?.person_id || '–'
  const daUrl = buildDigitalarkivetUrl(preferred, birth?.date_year)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
        {fullName}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        ID: {person?.person_id}
      </div>
      {daUrl && (
        <a
          href={daUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Søk i Digitalarkivet →
        </a>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        <span>Kjønn: <b style={{ color: 'var(--color-text)' }}>{person?.sex === 'M' ? 'Mann' : person?.sex === 'F' ? 'Kvinne' : '–'}</b></span>
        <span>Født: <b style={{ color: 'var(--color-text)' }}>{birth ? [birth.date_day, birth.date_month, birth.date_year].filter(Boolean).join('/') : '–'}</b></span>
        <span>Død: <b style={{ color: 'var(--color-text)' }}>{death ? [death.date_day, death.date_month, death.date_year].filter(Boolean).join('/') : '–'}</b></span>
        <span>Biografi: <b style={{ color: 'var(--color-text)' }}>{bio ? 'Ja' : 'Nei'}</b></span>
        <span>Bilder: <b style={{ color: 'var(--color-text)' }}>{photoCount}</b></span>
        <span>Roller: <b style={{ color: 'var(--color-text)' }}>{roleCount}</b></span>
        <span>Adresser: <b style={{ color: 'var(--color-text)' }}>{addrCount}</b></span>
        <span>Kilder: <b style={{ color: 'var(--color-text)' }}>{sourceCount}</b></span>
      </div>
    </div>
  )
}

function RadioField({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', minWidth: 100 }}>{label}</span>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
          <input
            type="radio"
            name={label}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ accentColor: 'var(--color-accent)' }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

export function DuplikatPage() {
  const { id1, id2 } = useParams()
  const navigate = useNavigate()

  const [loading,  setLoading]  = useState(true)
  const [p1,       setP1]       = useState(null)
  const [p2,       setP2]       = useState(null)
  const [merging,  setMerging]  = useState(false)
  const [error,    setError]    = useState(null)

  // Radioknapp-valg
  const [selName,  setSelName]  = useState('1')
  const [selSex,   setSelSex]   = useState('1')
  const [selBirth, setSelBirth] = useState('1')
  const [selDeath, setSelDeath] = useState('1')
  const [selBio,   setSelBio]   = useState('1')

  useEffect(() => { load() }, [id1, id2])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [data1, data2] = await Promise.all([loadPerson(id1), loadPerson(id2)])
      setP1(data1)
      setP2(data2)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function doMerge() {
    if (!p1 || !p2) return
    setMerging(true)
    setError(null)

    const primaryId   = selName === '1' ? id1 : id2
    const secondaryId = primaryId === id1 ? id2 : id1
    const primary   = primaryId === id1 ? p1 : p2
    const secondary = primaryId === id1 ? p2 : p1

    try {
      // 1. Flytt ekteskap/familiekobling
      await supabase.from('families').update({ husband_id: primaryId }).eq('husband_id', secondaryId)
      await supabase.from('families').update({ wife_id: primaryId }).eq('wife_id', secondaryId)
      // 2. Flytt barn-kobling
      await supabase.from('family_children').update({ child_id: primaryId }).eq('child_id', secondaryId)
      // 3. Kopier navn (dedup på given+middle+surname)
      const existingNameKeys = new Set(primary.allNames.map(n => [n.given_name, n.middle_name, n.surname].join('|')))
      const newNames = secondary.allNames
        .filter(n => !existingNameKeys.has([n.given_name, n.middle_name, n.surname].join('|')))
        .map(({ id: _id, person_id: _pid, ...rest }) => ({ ...rest, person_id: primaryId, is_preferred: false }))
      if (newNames.length > 0) {
        await supabase.from('person_names').insert(newNames)
      }
      // 4. Kopier fakta (dedup på fact_type+date_year)
      const existingFactKeys = new Set(primary.allFacts.map(f => `${f.fact_type}|${f.date_year}|${f.date_month}|${f.date_day}`))
      const newFacts = secondary.allFacts
        .filter(f => !existingFactKeys.has(`${f.fact_type}|${f.date_year}|${f.date_month}|${f.date_day}`))
        .map(({ id: _id, person_id: _pid, ...rest }) => ({ ...rest, person_id: primaryId }))
      if (newFacts.length > 0) {
        await supabase.from('person_facts').insert(newFacts)
      }
      // 5. Flytt adresseperioder
      await supabase.from('address_periods').update({ entity_id: primaryId }).eq('entity_type', 'person').eq('entity_id', secondaryId)
      // 6. Kopier bilder
      const newPhotos = secondary.allPhotos.map(({ id: _id, person_id: _pid, ...rest }) => ({ ...rest, person_id: primaryId, is_primary: false, photo_order: (primary.photoCount || 0) + rest.photo_order }))
      if (newPhotos.length > 0) {
        await supabase.from('person_photos').insert(newPhotos)
      }
      // 7. Kopier roller
      const newRoles = secondary.allRoles.map(({ id: _id, person_id: _pid, ...rest }) => ({ ...rest, person_id: primaryId }))
      if (newRoles.length > 0) {
        await supabase.from('person_roles').insert(newRoles)
      }
      // 8. Kopier kilder
      const newSources = secondary.allSources.map(({ id: _id, person_id: _pid, ...rest }) => ({ ...rest, person_id: primaryId }))
      if (newSources.length > 0) {
        await supabase.from('person_sources').insert(newSources)
      }
      // 9. Biografi — bruk valgt versjon
      if (selBio !== 'none') {
        const bioSource = selBio === '1' ? (primaryId === id1 ? p1 : p2) : (primaryId === id1 ? p2 : p1)
        if (bioSource.bio) {
          const { biography_text, source_notes } = bioSource.bio
          const { data: existingBio } = await supabase.from('person_biography').select('id').eq('person_id', primaryId).maybeSingle()
          if (existingBio) {
            await supabase.from('person_biography').update({ biography_text, source_notes }).eq('person_id', primaryId)
          } else {
            await supabase.from('person_biography').insert({ person_id: primaryId, biography_text, source_notes })
          }
        }
      }
      // 10. Oppdater valgte felt på primærpersonen
      const selectedBirth = (selBirth === '1' ? (primaryId === id1 ? p1 : p2) : (primaryId === id1 ? p2 : p1)).birth
      const selectedDeath = (selDeath === '1' ? (primaryId === id1 ? p1 : p2) : (primaryId === id1 ? p2 : p1)).death
      const selectedSexData = (selSex === '1' ? (primaryId === id1 ? p1 : p2) : (primaryId === id1 ? p2 : p1)).person

      await supabase.from('persons').update({ sex: selectedSexData?.sex }).eq('person_id', primaryId)

      // Oppdater BIRT/DEAT fakta om nødvendig
      if (selectedBirth) {
        const { date_year, date_month, date_day, place_raw, place_city } = selectedBirth
        const existBirt = primary.allFacts.find(f => { const t = (f.fact_type||'').toUpperCase(); return t === 'BIRT' || t === 'BIRTH' })
        if (existBirt) {
          await supabase.from('person_facts').update({ date_year, date_month, date_day, place_raw, place_city }).eq('id', existBirt.id)
        }
      }
      if (selectedDeath) {
        const { date_year, date_month, date_day, place_raw, place_city } = selectedDeath
        const existDeat = primary.allFacts.find(f => { const t = (f.fact_type||'').toUpperCase(); return t === 'DEAT' || t === 'DEATH' })
        if (existDeat) {
          await supabase.from('person_facts').update({ date_year, date_month, date_day, place_raw, place_city }).eq('id', existDeat.id)
        }
      }

      // 11. Merk sekundær som slettet
      await supabase.from('persons').update({ is_deleted: true }).eq('person_id', secondaryId)

      navigate(`/person/${primaryId}`)
    } catch (e) {
      setError(e.message)
      setMerging(false)
    }
  }

  if (loading) return <Layout><div className="content-container" style={{ paddingTop: 'var(--space-10)' }}><LoadingSpinner /></div></Layout>

  if (error) return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)' }}>
        <div style={{ color: 'var(--color-error)', marginBottom: 'var(--space-4)' }}>Feil: {error}</div>
        <Link to="/datakvalitet" style={{ color: 'var(--color-accent)' }}>← Tilbake til datakvalitet</Link>
      </div>
    </Layout>
  )

  const nameOpts = [
    { value: '1', label: p1?.preferred ? [p1.preferred.given_name, p1.preferred.surname].filter(Boolean).join(' ') : id1 },
    { value: '2', label: p2?.preferred ? [p2.preferred.given_name, p2.preferred.surname].filter(Boolean).join(' ') : id2 },
  ]
  const sexOpts  = [{ value: '1', label: `Person 1 (${p1?.person?.sex || '–'})` }, { value: '2', label: `Person 2 (${p2?.person?.sex || '–'})` }]
  const birthOpts = [
    { value: '1', label: p1?.birth ? [p1.birth.date_day, p1.birth.date_month, p1.birth.date_year].filter(Boolean).join('/') || '–' : '–' },
    { value: '2', label: p2?.birth ? [p2.birth.date_day, p2.birth.date_month, p2.birth.date_year].filter(Boolean).join('/') || '–' : '–' },
  ]
  const deathOpts = [
    { value: '1', label: p1?.death ? [p1.death.date_day, p1.death.date_month, p1.death.date_year].filter(Boolean).join('/') || '–' : '–' },
    { value: '2', label: p2?.death ? [p2.death.date_day, p2.death.date_month, p2.death.date_year].filter(Boolean).join('/') || '–' : '–' },
  ]
  const bioOpts = [
    { value: '1', label: p1?.bio ? 'Person 1' : 'Person 1 (ingen)' },
    { value: '2', label: p2?.bio ? 'Person 2' : 'Person 2 (ingen)' },
    { value: 'none', label: 'Ingen' },
  ]

  return (
    <Layout>
      <div className="content-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
            Slå sammen duplikater
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            Velg hvilke feltverdier du vil beholde, deretter slå sammen. Øvrige data (navn-aliaser, adresser, roller, bilder, kilder) flettes automatisk.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={doMerge}
              disabled={merging}
              style={{
                padding: 'var(--space-2) var(--space-6)',
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                cursor: merging ? 'not-allowed' : 'pointer',
                opacity: merging ? 0.7 : 1,
              }}
            >
              {merging ? 'Slår sammen…' : 'Slå sammen →'}
            </button>
            <Link to="/datakvalitet" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Avbryt</Link>
          </div>
          {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' }}>Feil: {error}</p>}
        </div>

        {/* To kolonner: profiler */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            {p1 && <PersonColumn data={p1} label="Person 1" />}
          </div>
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            {p2 && <PersonColumn data={p2} label="Person 2" />}
          </div>
        </div>

        {/* Valgpanel */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
            Velg verdier for sammenslått profil
          </h2>
          <RadioField label="Navn (foretrukket)" value={selName}  onChange={setSelName}  options={nameOpts} />
          <RadioField label="Kjønn"               value={selSex}   onChange={setSelSex}   options={sexOpts} />
          <RadioField label="Fødsel"               value={selBirth} onChange={setSelBirth} options={birthOpts} />
          <RadioField label="Død"                  value={selDeath} onChange={setSelDeath} options={deathOpts} />
          <RadioField label="Biografi"             value={selBio}   onChange={setSelBio}   options={bioOpts} />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-4)' }}>
            Navn-aliaser, adresser, roller, bilder og kilder flettes automatisk fra begge profiler.
            Sekundærprofilen markeres som slettet.
          </p>
        </div>

      </div>
    </Layout>
  )
}
