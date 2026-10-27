import { LinkPreview } from './LinkPreview'
import { matchInstitution, useInstitutionAliases } from '../lib/institutions'

// Viser navnet som lenke til artikkelen når det finnes en, ellers som vanlig tekst.
export function InstitutionLink({ name, children }) {
  const aliases = useInstitutionAliases()
  if (!name) return null
  const hit = matchInstitution(name, aliases)
  const label = children ?? name
  if (!hit) return <>{label}</>
  return <LinkPreview to={`/place/${hit.id}`}>{label}</LinkPreview>
}
