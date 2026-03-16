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
let _cache = null        // { parentMap: Map, sexMap: Map }
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

async function loadGraph() {
  if (_cache || _loading) return
  _loading = true

  try {
    const [families, familyChildren, persons, names] = await Promise.all([
      fetchAll('families', 'family_id, husband_id, wife_id'),
      fetchAll('family_children', 'family_id, child_id'),
      fetchAll('persons', 'person_id, sex'),
      fetchAll('person_names', 'person_id, given_name, is_preferred'),
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

    _cache = { parentMap, spouseMap, childMap, sexMap, nameMap }
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
