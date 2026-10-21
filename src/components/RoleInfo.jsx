import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ACQUIRED_LABELS } from '../lib/roles'

/**
 * Felles visning av roller koblet til rollekatalogen (role_catalog).
 *
 * En rolle-rad (person_roles) har:
 *   value          – standardisert navn, f.eks. «Høyesterettsadvokat»
 *   original_value – slik kilden skrev det, f.eks. «Høiesteretsadvokat»
 *   role_id        – peker til role_catalog
 *   acquired_by    – fødsel | ekteskap | utnevnelse | erverv
 *   catalog        – innebygd role_catalog-rad (fra select '*, catalog:role_catalog(...)')
 */

/** Rollenavn som lenke til rollesiden når rollen er katalogisert. */
export function RoleName({ role, children }) {
  const label = children ?? role?.value
  if (!role?.role_id) return <>{label}</>
  return (
    <Link to={`/rolle/${role.role_id}`} style={{ color: 'inherit', textDecorationColor: 'var(--color-border)' }}>
      {label}
    </Link>
  )
}

/** «I kilden: Høiesteretsadvokat» når kildens skrivemåte avviker. */
export function RoleSourceNote({ role, style }) {
  const orig = role?.original_value
  if (!orig || orig.trim().toLowerCase() === (role.value || '').trim().toLowerCase()) return null
  return (
    <span
      title="Slik rollen er skrevet i kilden"
      style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', fontStyle: 'italic', ...style }}
    >
      i kilden: «{orig}»
    </span>
  )
}

/** Liten merkelapp for hvordan en tittel ble oppnådd. */
export function AcquiredBadge({ value }) {
  const label = ACQUIRED_LABELS[value]
  if (!label) return null
  return (
    <span className="badge" style={{ fontSize: 'var(--text-xs)', background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
      {label}
    </span>
  )
}

/** Merknad om at forklaringen ikke er kvalitetssikret. */
export function UnapprovedNote({ catalog }) {
  if (!catalog || catalog.is_approved) return null
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
      Forklaringen er AI-generert og ikke kvalitetssikret.
    </span>
  )
}

/** «Hva innebar dette?» – utvidbar forklaring fra katalogen. */
export function RoleExplainer({ catalog, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!catalog?.description) return null
  const meta = [catalog.period, catalog.context].filter(Boolean).join(' · ')
  return (
    <div style={{ marginTop: 'var(--space-1)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--color-accent)', fontSize: 'var(--text-xs)',
        }}
      >
        {open ? 'Skjul forklaring' : 'Hva innebar dette?'}
      </button>
      {open && (
        <div style={{
          marginTop: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)',
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', fontSize: 'var(--text-sm)', lineHeight: 1.5,
          color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span>{catalog.description}</span>
          {meta && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>{meta}</span>}
          <UnapprovedNote catalog={catalog} />
        </div>
      )}
    </div>
  )
}
