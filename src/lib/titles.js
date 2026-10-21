/**
 * Titler som vises foran navnet: høyeste kongelige, fyrstelige eller adelige
 * tittel en person har i rollekatalogen. Lastes én gang per økt.
 *
 * Embeter og rangtitler (kammerherre, prost …) vises ikke foran navnet –
 * de står i karrieren på personsiden.
 */
import { supabase } from '../supabase'

const DISPLAY_GROUPS = ['Kongelig og fyrstelig', 'Titulert adel']

/** Kortform foran navn (norsk praksis: liten forbokstav, «kong», «grev»). */
const SHORT = {
  'Keiser': 'keiser', 'Konge': 'kong', 'Dronning': 'dronning',
  'Kronprins': 'kronprins', 'Prins': 'prins', 'Prinsesse': 'prinsesse',
  'Storhertug': 'storhertug', 'Storhertuginne': 'storhertuginne',
  'Kurfyrste': 'kurfyrste', 'Kurfyrstinne': 'kurfyrstinne', 'Kurprinsesse': 'kurprinsesse',
  'Hertug': 'hertug', 'Hertuginne': 'hertuginne', 'Erkehertuginne': 'erkehertuginne',
  'Markgreve': 'markgreve', 'Markgrevinne': 'markgrevinne',
  'Landgreve': 'landgreve', 'Landgrevinne': 'landgrevinne',
  'Fyrste': 'fyrst', 'Fyrstinne': 'fyrstinne',
  'Greve': 'grev', 'Grevinne': 'grevinne', 'Riksgreve': 'riksgreve', 'Riksgrevinne': 'riksgrevinne',
  'Lensgreve': 'lensgreve', 'Komtesse': 'komtesse',
  'Baron': 'baron', 'Baronesse': 'baronesse', 'Lensbaron': 'lensbaron', 'Riksfriherre': 'riksfriherre',
}

let titleMap = new Map()

/** Tittel foran navnet for en person, eller null. */
export function getDisplayTitle(personId) {
  return (personId && titleMap.get(personId)) || null
}

/** Henter høyeste tittel per person. Trygg å kalle flere ganger. */
export async function loadDisplayTitles() {
  const { data, error } = await supabase
    .from('person_roles')
    .select('person_id, catalog:role_catalog!inner(name, rank_order, social_group, category)')
    .eq('catalog.category', 'title')
    .in('catalog.social_group', DISPLAY_GROUPS)
    .not('catalog.rank_order', 'is', null)
    .limit(5000)
  if (error) return false
  const best = new Map()
  ;(data || []).forEach(r => {
    const c = r.catalog
    if (!c || !SHORT[c.name]) return
    const cur = best.get(r.person_id)
    if (!cur || c.rank_order > cur.rank) best.set(r.person_id, { rank: c.rank_order, short: SHORT[c.name] })
  })
  titleMap = new Map([...best].map(([pid, v]) => [pid, v.short]))
  return true
}
