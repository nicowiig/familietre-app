/**
 * kinship.js — Slektsberegning via felles ane (BFS)
 * Rene funksjoner, ingen Supabase-avhengighet.
 */

/**
 * Bygger et Map: childId → [parentId, ...] fra Supabase-tabellene
 * families (family_id, husband_id, wife_id) og
 * family_children (family_id, child_id).
 */
export function buildParentMap(families, familyChildren) {
  // family_id → [husband_id, wife_id]
  const familyParents = new Map()
  for (const f of families) {
    const parents = []
    if (f.husband_id) parents.push(f.husband_id)
    if (f.wife_id) parents.push(f.wife_id)
    familyParents.set(f.family_id, parents)
  }

  // child_id → [parentId, ...]
  const parentMap = new Map()
  for (const fc of familyChildren) {
    const parents = familyParents.get(fc.family_id) ?? []
    if (!parentMap.has(fc.child_id)) parentMap.set(fc.child_id, [])
    for (const p of parents) {
      if (!parentMap.get(fc.child_id).includes(p)) {
        parentMap.get(fc.child_id).push(p)
      }
    }
  }
  return parentMap
}

/**
 * BFS oppover fra startId.
 * Returnerer Map<personId, generasjonsavstand> for alle aner innen maxGen.
 * startId selv er ikke med (avstand 0 tilhører selve personen, ikke en ane).
 */
export function getAncestors(startId, parentMap, maxGen = 12) {
  const result = new Map()
  const queue = [[startId, 0]]
  while (queue.length) {
    const [id, gen] = queue.shift()
    if (gen >= maxGen) continue
    const parents = parentMap.get(id) ?? []
    for (const p of parents) {
      if (!result.has(p)) {
        result.set(p, gen + 1)
        queue.push([p, gen + 1])
      }
    }
  }
  return result
}

/**
 * Finner slektskapsforhold mellom myId og theirId.
 * Returnerer { label, genMe, genThem, type } eller null.
 *
 * type: 'ancestor' | 'descendant' | 'sibling' | 'collateral'
 */
export function findKinship(myId, theirId, parentMap, sexMap) {
  if (!myId || !theirId || myId === theirId) return null

  const ancestorsOfMe = getAncestors(myId, parentMap, 25)
  const ancestorsOfThem = getAncestors(theirId, parentMap, 25)

  // Er theirId en direkte ane av meg?
  if (ancestorsOfMe.has(theirId)) {
    const genMe = ancestorsOfMe.get(theirId)
    const sex = sexMap?.get(theirId)
    const label = norwegianKinshipTerm(genMe, 0, sex)
    return { label, genMe, genThem: 0, type: 'ancestor' }
  }

  // Er jeg en direkte ane av theirId?
  if (ancestorsOfThem.has(myId)) {
    const genThem = ancestorsOfThem.get(myId)
    const sex = sexMap?.get(theirId)
    const label = norwegianKinshipTerm(0, genThem, sex)
    return { label, genMe: 0, genThem, type: 'descendant' }
  }

  // Finn felles aner
  let best = null
  for (const [anc, genMe] of ancestorsOfMe) {
    if (ancestorsOfThem.has(anc)) {
      const genThem = ancestorsOfThem.get(anc)
      const total = genMe + genThem
      if (!best || total < best.total) {
        best = { anc, genMe, genThem, total }
      }
    }
  }

  if (!best) return null

  const sex = sexMap?.get(theirId)
  const label = norwegianKinshipTerm(best.genMe, best.genThem, sex)
  if (!label) return null

  const type = best.genMe === 1 && best.genThem === 1 ? 'sibling' : 'collateral'
  return { label, genMe: best.genMe, genThem: best.genThem, type }
}

/**
 * Bygger et Map: parentId → [childId, ...] (motsatt av parentMap).
 */
export function buildChildMap(parentMap) {
  const childMap = new Map()
  for (const [childId, parents] of parentMap) {
    for (const parentId of parents) {
      if (!childMap.has(parentId)) childMap.set(parentId, [])
      childMap.get(parentId).push(childId)
    }
  }
  return childMap
}

/**
 * Bygger et Map: personId → [spouseId, ...] fra families-tabellen.
 */
export function buildSpouseMap(families) {
  const spouseMap = new Map()
  for (const f of families) {
    if (!f.husband_id || !f.wife_id) continue
    if (!spouseMap.has(f.husband_id)) spouseMap.set(f.husband_id, [])
    if (!spouseMap.has(f.wife_id)) spouseMap.set(f.wife_id, [])
    spouseMap.get(f.husband_id).push(f.wife_id)
    spouseMap.get(f.wife_id).push(f.husband_id)
  }
  return spouseMap
}

/**
 * Finner ektefelle/svigerfamilie-relasjon mellom myId og theirId.
 * Returnerer { label, type, via? } eller null.
 *
 * type: 'spouse' | 'in-law' | 'spouse-relative'
 * via: fornavn på ektefellen/barnet relasjonen går gjennom
 */
export function findSpouseKinship(myId, theirId, parentMap, spouseMap, sexMap, nameMap, childMap) {
  if (!myId || !theirId || myId === theirId) return null

  const mySpouses = spouseMap?.get(myId) ?? []

  // Direkte ektefelle
  if (mySpouses.includes(theirId)) {
    const sex = sexMap?.get(theirId)
    const label = sex === 'F' ? 'kone' : sex === 'M' ? 'mann' : 'ektefelle'
    return { label, type: 'spouse' }
  }

  // Via mine ektefeller: svigerfar/svigermor og ektefellens slektninger
  for (const spouseId of mySpouses) {
    const spouseName = nameMap?.get(spouseId) ?? 'Ektefellen'

    // Forelder til ektefelle → svigerfar/svigermor
    const spouseParents = parentMap.get(spouseId) ?? []
    if (spouseParents.includes(theirId)) {
      const sex = sexMap?.get(theirId)
      const label = sex === 'F' ? 'svigermor' : sex === 'M' ? 'svigerfar' : 'svigerforelder'
      return { label, type: 'in-law', via: spouseName }
    }

    // Blodsslektning til ektefelle — f.eks. "Marlenes bror"
    const k = findKinship(spouseId, theirId, parentMap, sexMap)
    if (k) {
      return { label: k.label, type: 'spouse-relative', via: spouseName, genMe: k.genMe, genThem: k.genThem }
    }
  }

  // Via mine barn: svigersønn/svigerdatter og barnets slektninger
  const myChildren = childMap?.get(myId) ?? []
  for (const childId of myChildren) {
    const childName = nameMap?.get(childId) ?? 'Barnet'

    // Ektefelle til barn → svigersønn/svigerdatter
    const childSpouses = spouseMap?.get(childId) ?? []
    if (childSpouses.includes(theirId)) {
      const sex = sexMap?.get(theirId)
      const label = sex === 'F' ? 'svigerdatter' : sex === 'M' ? 'svigersønn' : 'svigerbarn'
      return { label, type: 'in-law', via: childName }
    }

    // Blodsslektning til barn — f.eks. "Marlenes mann" (sett fra Jons side)
    // NB: her er theirId en blodslektning til barnet mitt, ikke barnet selv
    const k = findKinship(childId, theirId, parentMap, sexMap)
    if (k) {
      return { label: k.label, type: 'spouse-relative', via: childName, genMe: k.genMe, genThem: k.genThem }
    }
  }

  return null
}

/**
 * Returnerer norsk slektsbetegnelse basert på generasjonsavstand.
 *
 * genMe  = antall ledd oppover fra meg til felles ane
 * genThem = antall ledd oppover fra dem til felles ane
 * sex    = 'M' | 'F' | null/undefined
 */
export function norwegianKinshipTerm(genMe, genThem, sex) {
  const M = sex === 'M'
  const F = sex === 'F'

  // Direkte ane (jeg er etterkommer)
  if (genThem === 0) {
    switch (genMe) {
      case 1: return M ? 'far' : F ? 'mor' : 'forelder'
      case 2: return M ? 'bestefar' : F ? 'bestemor' : 'besteforelder'
      case 3: return M ? 'oldefar' : F ? 'oldemor' : 'oldeforelder'
      case 4: return M ? 'tipp-oldefar' : F ? 'tipp-oldemor' : 'tipp-oldeforelder'
      default: return M ? 'forfar' : F ? 'formor' : 'forfar'
    }
  }

  // Direkte etterkommer
  if (genMe === 0) {
    switch (genThem) {
      case 1: return M ? 'sønn' : F ? 'datter' : 'barn'
      case 2: return 'barnebarn'
      case 3: return 'oldebarn'
      default: return 'etterkommer'
    }
  }

  // Søsken
  if (genMe === 1 && genThem === 1) {
    return M ? 'bror' : F ? 'søster' : 'søsken'
  }

  // Onkel/tante
  if (genMe === 2 && genThem === 1) return M ? 'onkel' : F ? 'tante' : 'onkel/tante'
  // Nevø/niese
  if (genMe === 1 && genThem === 2) return M ? 'nevø' : F ? 'niese' : 'nevø/niese'

  // Grandonkel/grandtante
  if (genMe === 3 && genThem === 1) return M ? 'grandonkel' : F ? 'grandtante' : 'grandonkel/grandtante'
  // Grandnevø/grandniese
  if (genMe === 1 && genThem === 3) return M ? 'grandnevø' : F ? 'grandniese' : 'grandnevø/grandniese'

  // Søskenbarn (fetter/kusine)
  if (genMe === 2 && genThem === 2) return M ? 'fetter' : F ? 'kusine' : 'søskenbarn'

  // Fetter/kusine 1× fjernet (2–3 eller 3–2)
  if ((genMe === 2 && genThem === 3) || (genMe === 3 && genThem === 2)) {
    return M ? 'fetter (1× fjernet)' : F ? 'kusine (1× fjernet)' : 'søskenbarn (1× fjernet)'
  }

  // Tremenning
  if (genMe === 3 && genThem === 3) return 'tremenning'

  // Firmenning
  if (genMe === 4 && genThem === 4) return 'firmenning'

  // Femmenning
  if (genMe === 5 && genThem === 5) return 'femmenning'

  // Fjerne slektninger — generisk
  if (genMe + genThem <= 24) return 'fjern slektning'

  return null
}
