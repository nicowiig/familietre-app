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
