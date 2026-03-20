/**
 * useFamilyGraph.js — Modul-cached graph-loading
 *
 * Laster families + family_children + persons én gang per økt.
 * Alle komponenter som kaller denne hooken deler samme cache.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { buildParentMap, buildSpouseMap, buildChildMap } from '../lib/kinship'

// Modul-nivå cache — overlever re-renders og komponent-unmounting
let _cache = null        // { parentMap, spouseMap, childMap, sexMap, nameMap, infoMap }
let _loading = false
let _listeners = []      // callbacks som venter på at cache er klar

function notifyListeners() {
  const cbs = _listeners.slice()
  _listeners = []
  for (const cb of cbs) cb()
}

/** Henter alle rader fra en tabell ved å paginere i bolker på 1000. */
async function fetchAll(table, columns) {
  const PAGE = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

/** Henter BIRT og DEAT-fakta for alle personer (for å bygge infoMap). */
async function fetchBirthDeathFacts() {
  const PAGE = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await supabase
      .from('person_facts')
      .select('person_id, fact_type, date_year')
      .in('fact_type', ['BIRT', 'DEAT'])
      .range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function loadGraph() {
  if (_cache || _loading) return
  _loading = true

  try {
    const [families, familyChildren, persons, names, bdFacts] = await Promise.all([
      fetchAll('families', 'family_id, husband_id, wife_id'),
      fetchAll('family_children', 'family_id, child_id'),
      fetchAll('persons', 'person_id, sex'),
      fetchAll('person_names', 'person_id, given_name, surname, is_preferred'),
      fetchBirthDeathFacts(),
    ])

    const parentMap = buildParentMap(families, familyChildren)
    const spouseMap = buildSpouseMap(families)
    const childMap = buildChildMap(parentMap)

    const sexMap = new Map()
    for (const p of persons) {
      if (p.sex) sexMap.set(p.person_id, p.sex)
    }

    // Fornavn (kun preferred) — brukes til "Marlenes far" etc.
    const nameMap = new Map()
    for (const n of names) {
      if (n.is_preferred && n.given_name) nameMap.set(n.person_id, n.given_name)
    }

    // infoMap: full info for trevisning — { givenName, surname, birthYear, deathYear, sex }
    const infoMap = new Map()

    // Initialiser fra persons
    for (const p of persons) {
      infoMap.set(p.person_id, {
        givenName: null,
        surname: null,
        birthYear: null,
        deathYear: null,
        sex: p.sex || null,
      })
    }

    // Fyll inn navn (preferred har prioritet)
    for (const n of names) {
      if (!infoMap.has(n.person_id)) {
        infoMap.set(n.person_id, { givenName: null, surname: null, birthYear: null, deathYear: null, sex: null })
      }
      const info = infoMap.get(n.person_id)
      if (n.is_preferred || !info.givenName) {
        if (n.given_name) info.givenName = n.given_name
        if (n.surname) info.surname = n.surname
      }
    }

    // Fyll inn fødsels- og dødsår
    for (const f of bdFacts) {
      if (!infoMap.has(f.person_id)) continue
      const info = infoMap.get(f.person_id)
      const type = f.fact_type
      if (type === 'BIRT' && f.date_year) {
        info.birthYear = f.date_year
      } else if (type === 'DEAT' && f.date_year) {
        info.deathYear = f.date_year
      }
    }

    _cache = { parentMap, spouseMap, childMap, sexMap, nameMap, infoMap }
  } catch (err) {
    console.error('[useFamilyGraph] Kunne ikke laste familiegraf:', err)
    _loading = false
    notifyListeners()
    return
  }

  _loading = false
  notifyListeners()
}

export function useFamilyGraph() {
  const [graph, setGraph] = useState(_cache)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) {
      setGraph(_cache)
      setLoading(false)
      return
    }

    let active = true
    _listeners.push(() => {
      if (active) {
        setGraph(_cache)
        setLoading(false)
      }
    })

    loadGraph()

    return () => { active = false }
  }, [])

  return { graph, loading }
}
