/**
 * useFamilyGraph.js — Modul-cached graph-loading
 *
 * Laster families + family_children + persons én gang per økt.
 * Alle komponenter som kaller denne hooken deler samme cache.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { buildParentMap } from '../lib/kinship'

// Modul-nivå cache — overlever re-renders og komponent-unmounting
let _cache = null        // { parentMap: Map, sexMap: Map }
let _loading = false
let _listeners = []      // callbacks som venter på at cache er klar

function notifyListeners() {
  const cbs = _listeners.slice()
  _listeners = []
  for (const cb of cbs) cb()
}

async function loadGraph() {
  if (_cache || _loading) return
  _loading = true

  try {
    const [familiesRes, childrenRes, personsRes] = await Promise.all([
      supabase.from('families').select('family_id, husband_id, wife_id'),
      supabase.from('family_children').select('family_id, child_id'),
      supabase.from('persons').select('person_id, sex'),
    ])

    if (familiesRes.error) throw familiesRes.error
    if (childrenRes.error) throw childrenRes.error
    if (personsRes.error) throw personsRes.error

    const parentMap = buildParentMap(familiesRes.data ?? [], childrenRes.data ?? [])

    const sexMap = new Map()
    for (const p of (personsRes.data ?? [])) {
      if (p.sex) sexMap.set(p.person_id, p.sex)
    }

    _cache = { parentMap, sexMap }
  } catch (err) {
    console.error('[useFamilyGraph] Kunne ikke laste familiegraf:', err)
    // Ikke sett _cache — la komponenter prøve igjen ved neste mount
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

    // Registrer listener som oppdaterer state når cache er klar
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
