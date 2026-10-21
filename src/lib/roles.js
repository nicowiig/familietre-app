/**
 * Rollekatalog – felles konstanter.
 * Se supabase/seed/role_catalog/ for selve katalogen.
 */

/** Select-streng som henter en rolle-rad med innebygd katalogrolle. */
export const ROLE_CATALOG_SELECT =
  '*, catalog:role_catalog(id, name, category, social_group, description, period, context, is_approved)'

export const CATEGORY_LABELS = {
  occupation:    'Yrke',
  position:      'Embete / stilling',
  title:         'Tittel',
  military_rank: 'Militær grad',
  education:     'Utdanning',
  other:         'Annet',
}

/** Stand / sosialt lag, i visningsrekkefølge. */
export const SOCIAL_GROUPS = [
  'Kongelig og fyrstelig',
  'Titulert adel',
  'Utitulert adel',
  'Hoff',
  'Geistlige',
  'Sivile embetsmenn',
  'Offiserer',
  'Underoffiserer og menige',
  'Borgerskap – handel',
  'Borgerskap – håndverk',
  'Sjøfolk',
  'Bønder og jordeiere',
  'Akademikere og frie yrker',
  'Funksjonærer',
  'Tjenestefolk og arbeidere',
  'Politikere og tillitsverv',
  'Moderne arbeidsliv',
]

export const ACQUIRED_LABELS = {
  'fødsel':     'ved fødsel',
  'ekteskap':   'ved ekteskap',
  'utnevnelse': 'utnevnt',
  'erverv':     'ervervet',
}

/* ---------- Hovedyrke (vises under navnet på personsiden) ----------
 *
 * Regler:
 *  1. En rolle merket is_primary vinner alltid (manuell overstyring).
 *  2. Kandidater: yrke, stilling, tittel og militær grad. Ikke utdanning, styreverv,
 *     «andre roller» eller verneplikt – med mindre det er alt vi har.
 *  3. Levende: nåværende stilling (uten sluttdato), ellers den sist påbegynte.
 *  4. Døde: «mest kjente» = høyest poengsum:
 *       grunnpoeng  stilling/embete 3 · yrke/tittel/militær 2
 *       + ledernivå (direktør, sjef, leder, stadskonduktør, professor, biskop, general …) 2
 *       − assistent/fullmektig/elev/lærling/kasserer 2
 *       + varighet (år/10, maks 4; ukjent varighet = 1)
 *     Likt: lengst varighet, så sist påbegynt.
 */
const PRIMARY_TYPES = new Set(['occupation', 'position', 'title', 'military_rank', 'OCCU', 'TITL'])
const EXCLUDE_RE = /\b(styre(medlem|leder|formann)|varamedlem|initiativtaker|medlem)\b/i
const SENIOR_RE = /(direktør|sjef\b|bygningssjef|\bleder\b|formann|stadskonduktør|professor|biskop|prost|general|admiral|amtmann|stiftamtmann|borgermester|rektor|overlege|president|minister|statsråd|høyesterett|dommer|lagmann|konsul)/i
const JUNIOR_RE = /(assistent|fullmektig|\belev\b|lærling|kasserer|kontorist|volontør|vikar)/i

function yearOf(v) { const m = String(v || '').match(/^(\d{4})/); return m ? +m[1] : null }

export function pickPrimaryRole(roles = [], { isLiving = false } = {}) {
  const all = roles.filter(r => r.value && PRIMARY_TYPES.has(r.role_type))
  if (!all.length) return null
  const pinned = all.find(r => r.is_primary)
  if (pinned) return pinned

  let cands = all.filter(r => !EXCLUDE_RE.test(r.value) && !(r.role_type === 'military_rank' && /vernepliktig|soldat/i.test(r.value)))
  if (!cands.length) cands = all

  const start = r => yearOf(r.date_from) ?? -Infinity
  if (isLiving) {
    const current = cands.filter(r => !r.date_to)
    const pool = current.length ? current : cands
    return [...pool].sort((a, b) => start(b) - start(a) || String(b.date_from || '').localeCompare(String(a.date_from || '')))[0]
  }

  const score = r => {
    const base = r.role_type === 'position' ? 3 : 2
    const senior = SENIOR_RE.test(r.value) ? 2 : 0
    const junior = JUNIOR_RE.test(r.value) ? -2 : 0
    const from = yearOf(r.date_from), to = yearOf(r.date_to)
    const years = from && to ? Math.max(0, to - from) : null
    return { s: base + senior + junior + (years == null ? 1 : Math.min(years / 10, 4)), years: years ?? 0 }
  }
  return [...cands].map(r => ({ r, ...score(r) }))
    .sort((a, b) => b.s - a.s || b.years - a.years || start(b.r) - start(a.r))[0].r
}
