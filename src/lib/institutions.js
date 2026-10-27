import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Kobler institusjonsnavn (f.eks. «Bergens Privatbank» i en CV) til artikler med egen beskrivelse.
// Aliasene ligger i place_article_aliases og lastes én gang per sidevisning.

let cache = null
let pending = null
const listeners = new Set()

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadAliases() {
  if (cache) return cache
  if (!pending) {
    pending = Promise.all([
      supabase.from('place_article_aliases').select('alias, article_id, place_articles(id, title)'),
      // Institusjonsartiklenes egne titler fungerer alltid som alias
      supabase.from('place_articles').select('id, title').eq('article_type', 'institution'),
    ])
      .then(([aliasRes, titleRes]) => {
        const fromAliases = (aliasRes.data || [])
          .filter(a => a.place_articles)
          .map(a => ({ alias: norm(a.alias), id: a.article_id, title: a.place_articles.title }))
        const fromTitles = (titleRes.data || []).map(a => ({ alias: norm(a.title), id: a.id, title: a.title }))
        cache = [...fromAliases, ...fromTitles]
          .filter(a => a.alias)
          // Lengste alias først, så «Bergens Privatbank» vinner over «Bergen»
          .sort((a, b) => b.alias.length - a.alias.length)
        listeners.forEach(fn => fn(cache))
        return cache
      })
  }
  return pending
}

// Treff når navnet er lik aliaset, eller begynner med aliaset etterfulgt av noe som ikke er bokstav/tall
// («Wiig & Co., Bergen (Vågsalmenning 3)» → «Wiig & Co»).
export function matchInstitution(name, aliases) {
  const n = norm(name)
  if (!n || !aliases) return null
  for (const a of aliases) {
    if (n === a.alias) return a
    if (n.startsWith(a.alias)) {
      const next = n.charAt(a.alias.length)
      if (!/[\p{L}\p{N}]/u.test(next)) return a
    }
  }
  return null
}

export function useInstitutionAliases() {
  const [aliases, setAliases] = useState(cache)
  useEffect(() => {
    if (cache) return
    listeners.add(setAliases)
    loadAliases()
    return () => listeners.delete(setAliases)
  }, [])
  return aliases
}

