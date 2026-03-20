import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useFamilyGraph } from '../hooks/useFamilyGraph'
import { useAuth } from '../contexts/AuthContext'

// ─── Layout-konstanter ───────────────────────────────────
const NODE_W = 160
const NODE_H = 72
const H_GAP  = 24
const V_GAP  = 64

// ─── Hjelpefunksjoner ────────────────────────────────────

/** Returner antall leaf-slots denne noden tar (for descendant-layout). */
function subtreeWidth(id, childMap, maxGen, curGen = 0) {
  if (curGen >= maxGen - 1) return 1
  const children = childMap?.get(id) ?? []
  if (!children.length) return 1
  return children.reduce((s, c) => s + subtreeWidth(c, childMap, maxGen, curGen + 1), 0)
}

/**
 * Aner-layout: fokusperson nederst, aner oppover.
 * Gen 0 = bunn, gen maxGen-1 = topp.
 */
function buildAncestorLayout(focusId, parentMap, infoMap, maxGen) {
  const nodes = []
  const edges = []
  const totalBaseSlots = Math.pow(2, maxGen - 1)
  const totalWidth = totalBaseSlots * (NODE_W + H_GAP)

  const queue = [{ id: focusId, gen: 0, idx: 0 }]
  const placed = new Set()

  while (queue.length > 0) {
    const { id, gen, idx } = queue.shift()
    if (!id) continue
    const key = `${gen}-${idx}`
    if (placed.has(key)) continue
    placed.add(key)

    const slotsInGen = Math.pow(2, gen)
    const slotWidth  = totalWidth / slotsInGen
    const x = slotWidth * (idx + 0.5) - NODE_W / 2
    const y = (maxGen - 1 - gen) * (NODE_H + V_GAP)

    const info = infoMap?.get(id) || {}
    nodes.push({ id, x, y, gen, idx, isFocus: gen === 0, ...info })

    if (gen < maxGen - 1) {
      const parents = parentMap?.get(id) || []
      const { left, right } = splitParents(parents, infoMap)

      if (left) {
        queue.push({ id: left, gen: gen + 1, idx: idx * 2 })
        edges.push({ id: `e-${id}-${left}`, fromId: id, toId: left })
      }
      if (right) {
        queue.push({ id: right, gen: gen + 1, idx: idx * 2 + 1 })
        edges.push({ id: `e-${id}-${right}`, fromId: id, toId: right })
      }
    }
  }

  return { nodes, edges }
}

/**
 * Etterkommere-layout: fokusperson øverst, etterkommere nedover.
 * Rekursiv Reingold-Tilford-stil.
 */
function buildDescendantLayoutRec(id, childMap, infoMap, maxGen, curGen = 0, startX = 0) {
  const width = subtreeWidth(id, childMap, maxGen, curGen)
  const totalSlotWidth = width * (NODE_W + H_GAP)
  const x = startX + (totalSlotWidth - NODE_W) / 2
  const y = curGen * (NODE_H + V_GAP)

  const info = infoMap?.get(id) || {}
  const node = { id, x, y, gen: curGen, isFocus: curGen === 0, ...info }

  const nodes = [node]
  const edges = []

  if (curGen < maxGen - 1) {
    const children = childMap?.get(id) ?? []
    let childStartX = startX
    for (const childId of children) {
      const childWidth = subtreeWidth(childId, childMap, maxGen, curGen + 1)
      const result = buildDescendantLayoutRec(childId, childMap, infoMap, maxGen, curGen + 1, childStartX)
      nodes.push(...result.nodes)
      edges.push({ id: `e-${id}-${childId}`, fromId: id, toId: childId }, ...result.edges)
      childStartX += childWidth * (NODE_W + H_GAP)
    }
  }

  return { nodes, edges }
}

function buildDescendantLayout(focusId, childMap, infoMap, maxGen) {
  return buildDescendantLayoutRec(focusId, childMap, infoMap, maxGen)
}

/**
 * Sandglass-layout: aner over fokusperson, etterkommere under.
 * Fokusperson i midten.
 */
function buildSandglassLayout(focusId, parentMap, childMap, infoMap, maxGen) {
  const ancResult  = buildAncestorLayout(focusId, parentMap, infoMap, maxGen)
  const descResult = buildDescendantLayout(focusId, childMap, infoMap, maxGen)

  const focusAncNode  = ancResult.nodes.find(n => n.id === focusId)
  const focusDescNode = descResult.nodes.find(n => n.id === focusId)

  // Etterkommere (unntatt fokus) flyttes ned til under fokusposisjonen
  const focusY = focusAncNode?.y ?? (maxGen - 1) * (NODE_H + V_GAP)
  const yShift = focusY + NODE_H + V_GAP

  const descNodesShifted = descResult.nodes
    .filter(n => n.id !== focusId)
    .map(n => ({ ...n, y: n.y + yShift }))

  // Sentrér etterkommere under fokuspersonen
  const ancFocusCenterX = (focusAncNode?.x ?? 0) + NODE_W / 2
  const descFocusCenterX = (focusDescNode?.x ?? 0) + NODE_W / 2
  const descXShift = ancFocusCenterX - descFocusCenterX

  const finalDescNodes = descNodesShifted.map(n => ({ ...n, x: n.x + descXShift }))

  return {
    nodes: [...ancResult.nodes, ...finalDescNodes],
    edges: [...ancResult.edges, ...descResult.edges],
  }
}

/** Fordel foreldrepar på far (venstre) og mor (høyre) basert på kjønn. */
function splitParents(parents, infoMap) {
  let left = null, right = null
  for (const pid of parents) {
    const sex = infoMap?.get(pid)?.sex
    if (sex === 'M' && !left)  left  = pid
    if (sex === 'F' && !right) right = pid
  }
  // Fallback: ubestemt kjønn
  if (!left && !right) { left = parents[0] ?? null; right = parents[1] ?? null }
  else if (!left)  left  = parents.find(p => p !== right) ?? null
  else if (!right) right = parents.find(p => p !== left)  ?? null
  return { left, right }
}

/** Elbow-sti fra øvre nodes bunn-senter → nedre nodes topp-senter.
 *  For noder på samme nivå: horisontal linje (ektefelle). */
function elbowPath(nodeMap, fromId, toId) {
  const from = nodeMap.get(fromId)
  const to   = nodeMap.get(toId)
  if (!from || !to) return ''

  const upper = from.y <= to.y ? from : to
  const lower = from.y <= to.y ? to   : from

  const ux  = upper.x + NODE_W / 2
  const uy  = upper.y + NODE_H
  const lx  = lower.x + NODE_W / 2
  const ly  = lower.y
  const gap = ly - uy

  // Samme Y-nivå: horisontal linje mellom nodene (gap <= 0 betyr begge på samme y)
  if (gap <= 0) {
    const left  = from.x <= to.x ? from : to
    const right = from.x <= to.x ? to   : from
    const cy = left.y + NODE_H / 2
    return `M ${left.x + NODE_W} ${cy} H ${right.x}`
  }

  const midY = uy + gap / 2
  return `M ${ux} ${uy} V ${midY} H ${lx} V ${ly}`
}

// ─── TreeNode ────────────────────────────────────────────

function TreeNode({ node, focusPersonId, myPersonId, onNavigate, onOpenProfile }) {
  const isFocus   = node.id === focusPersonId
  const isMe      = node.id === myPersonId
  const isSpouse  = node.nodeType === 'spouse'
  const isSibling = node.nodeType === 'sibling'

  const name  = [node.givenName, node.surname].filter(Boolean).join(' ') || 'Ukjent'
  let   years = ''
  if (node.birthYear && node.deathYear) years = `${node.birthYear} – ${node.deathYear}`
  else if (node.birthYear) years = `f. ${node.birthYear}`
  else if (node.deathYear) years = `d. ${node.deathYear}`

  let borderStyle = '1px solid var(--color-border)'
  if (isFocus)   borderStyle = '2px solid var(--color-accent)'
  if (isSpouse)  borderStyle = '1.5px dashed var(--color-accent)'
  if (isSibling) borderStyle = '1px dashed var(--color-border)'

  let bgColor = 'var(--color-bg, #f7f3ec)'
  if (isMe)     bgColor = 'rgba(122, 58, 26, 0.09)'
  if (isSibling) bgColor = 'rgba(0,0,0,0.02)'

  return (
    <foreignObject
      x={node.x}
      y={node.y}
      width={NODE_W}
      height={NODE_H}
      style={{ overflow: 'visible' }}
    >
      <div
        title={name}
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onNavigate(node.id)}
        style={{
          position:        'relative',
          width:           NODE_W + 'px',
          height:          NODE_H + 'px',
          boxSizing:       'border-box',
          border:          borderStyle,
          borderRadius:    '6px',
          backgroundColor: bgColor,
          cursor:          'pointer',
          padding:         '8px 24px 8px 10px',
          overflow:        'hidden',
          display:         'flex',
          flexDirection:   'column',
          justifyContent:  'center',
          userSelect:      'none',
          opacity:         isSibling ? 0.75 : 1,
          boxShadow:       isFocus ? '0 0 0 1px var(--color-accent)' : 'none',
        }}
      >
        <div style={{
          fontSize:     '12px',
          fontWeight:   isFocus ? 600 : 400,
          color:        'var(--color-text)',
          lineHeight:   1.3,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          fontFamily:   'var(--font-body)',
        }}>
          {name}
        </div>
        {years && (
          <div style={{
            fontSize:   '11px',
            color:      'var(--color-text-muted)',
            marginTop:  '2px',
            fontFamily: 'var(--font-body)',
          }}>
            {years}
          </div>
        )}
        {/* Profil-ikon: åpner personside */}
        <div
          title="Åpne profil"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onOpenProfile(node.id) }}
          style={{
            position: 'absolute',
            top:      '5px',
            right:    '5px',
            opacity:  0.55,
            lineHeight: 1,
            padding:  '2px',
            cursor:   'pointer',
            color:    'var(--color-text)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
      </div>
    </foreignObject>
  )
}

// ─── TreePage ────────────────────────────────────────────

export function TreePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { personId: myPersonId } = useAuth()
  const { graph, loading: graphLoading } = useFamilyGraph()

  const personId = searchParams.get('person') || myPersonId || ''
  const mode     = searchParams.get('mode') || 'aner'
  const [maxGen, setMaxGen] = useState(4)

  const containerRef  = useRef(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const isDragging    = useRef(false)
  const lastPointer   = useRef({ x: 0, y: 0 })

  // ─── Layout ────────────────────────────────────────────
  const { nodes, edges } = useMemo(() => {
    if (!graph || !personId) return { nodes: [], edges: [] }
    const { parentMap, childMap, infoMap } = graph
    try {
      if (mode === 'aner') {
        return buildAncestorLayout(personId, parentMap, infoMap, maxGen)
      } else if (mode === 'etterkommere') {
        return buildDescendantLayout(personId, childMap, infoMap, maxGen)
      } else {
        return buildSandglassLayout(personId, parentMap, childMap, infoMap, maxGen)
      }
    } catch (err) {
      console.error('[TreePage] Layout-feil:', err)
      return { nodes: [], edges: [] }
    }
  }, [graph, personId, mode, maxGen])

  const nodeMap = useMemo(() => {
    const m = new Map()
    nodes.forEach(n => m.set(n.id, n))
    return m
  }, [nodes])

  // ─── Søsken, ektefelle og alle par-koblinger ───────────
  const { allNodes, allEdges, familyConnector, parentCoupleConnectors } = useMemo(() => {
    if (!graph || !nodes.length) return { allNodes: nodes, allEdges: edges, familyConnector: null, parentCoupleConnectors: [] }
    const focusNode = nodes.find(n => n.id === personId)
    if (!focusNode) return { allNodes: nodes, allEdges: edges, familyConnector: null, parentCoupleConnectors: [] }

    const existingIds  = new Set(nodes.map(n => n.id))
    const extraNodes   = []
    const extraEdges   = []
    const edgesToRemove = new Set()
    const parentCoupleConnectors = []

    // Søsken: vises kun i aner-modus (til venstre for fokusperson)
    if (mode === 'aner') {
      const parents    = graph.parentMap.get(personId) ?? []
      const siblingIds = []
      const seenSib    = new Set([personId])
      for (const parentId of parents) {
        for (const sibId of (graph.childMap.get(parentId) ?? [])) {
          if (!seenSib.has(sibId) && !existingIds.has(sibId)) {
            seenSib.add(sibId)
            siblingIds.push(sibId)
          }
        }
      }
      let sibX = focusNode.x - H_GAP
      for (const sibId of [...siblingIds].reverse()) {
        sibX -= NODE_W
        const info = graph.infoMap.get(sibId) || {}
        extraNodes.push({ id: sibId, x: sibX, y: focusNode.y, nodeType: 'sibling', isFocus: false, gen: 0, ...info })
        sibX -= H_GAP
      }
    }

    // Ektefelle(r): vis i alle modi til høyre for fokusperson
    const spouseIds  = graph.spouseMap.get(personId) ?? []
    const spouseNodes = []
    let spX = focusNode.x + NODE_W + H_GAP
    for (const spId of spouseIds) {
      if (existingIds.has(spId)) continue
      const info = graph.infoMap.get(spId) || {}
      const spNode = { id: spId, x: spX, y: focusNode.y, nodeType: 'spouse', isFocus: false, gen: 0, ...info }
      extraNodes.push(spNode)
      spouseNodes.push(spNode)
      extraEdges.push({ id: `sp-${personId}-${spId}`, fromId: personId, toId: spId, edgeType: 'spouse' })
      spX += NODE_W + H_GAP
    }

    // Midlertidig nodekart for oppslagsbruk
    const tempNodeMap = new Map()
    ;[...nodes, ...extraNodes].forEach(n => tempNodeMap.set(n.id, n))

    // ─── Par-koblinger for alle foreldrepar i aner/sandglass ─
    // Erstatter individuelle elbow-kanter med klassisk genealogi-T.
    // I sandglass-modus inneholder edges BÅDE aner-kanter (toId.y < fromId.y)
    // og desc-kanter (toId.y > fromId.y) — vi vil kun ha aner-kanter her.
    if (mode === 'aner' || mode === 'begge') {
      const byChild = new Map()
      for (const e of edges) {
        if (e.edgeType) continue
        const toNode   = tempNodeMap.get(e.toId)
        const fromNode = tempNodeMap.get(e.fromId)
        // Kun aner-kanter: target (forelder) skal være OVER source (barn)
        if (!toNode || !fromNode || toNode.y >= fromNode.y) continue
        if (!byChild.has(e.fromId)) byChild.set(e.fromId, [])
        byChild.get(e.fromId).push(e)
      }
      for (const [childId, childEdges] of byChild) {
        const parentNodes = childEdges.map(e => tempNodeMap.get(e.toId)).filter(Boolean)
        if (parentNodes.length !== 2) continue
        const child = tempNodeMap.get(childId)
        if (!child) continue

        const [p0, p1] = parentNodes
        const left  = p0.x <= p1.x ? p0 : p1
        const right = p0.x <= p1.x ? p1 : p0
        const leftCx      = left.x  + NODE_W / 2
        const rightCx     = right.x + NODE_W / 2
        const midX        = (leftCx + rightCx) / 2
        const parentBottomY = left.y + NODE_H
        const childTopY   = child.y
        const junctionY   = parentBottomY + (childTopY - parentBottomY) / 2

        parentCoupleConnectors.push({ id: `couple-${childId}`, leftCx, rightCx, midX, parentBottomY, junctionY, childCx: child.x + NODE_W / 2, childTopY })
        for (const e of childEdges) edgesToRemove.add(e.id)
      }
    }

    // ─── Familie-kobling: fokusperson + ektefelle → barn ───
    let familyConnector = null
    if (spouseNodes.length > 0 && mode !== 'aner') {
      const childEdges = edges.filter(e => {
        if (e.fromId !== personId || e.edgeType) return false
        const target = nodes.find(n => n.id === e.toId)
        return target && target.y > focusNode.y
      })
      const childNodes = childEdges
        .map(e => nodes.find(n => n.id === e.toId))
        .filter(Boolean)
        .sort((a, b) => a.x - b.x)

      if (childNodes.length > 0) {
        const spouse   = spouseNodes[0]
        const midX     = (focusNode.x + NODE_W / 2 + spouse.x + NODE_W / 2) / 2
        const coupleY  = focusNode.y + NODE_H / 2
        const childrenTopY = Math.min(...childNodes.map(n => n.y))
        const junctionY = focusNode.y + NODE_H + (childrenTopY - focusNode.y - NODE_H) / 2

        familyConnector = {
          midX, coupleY, junctionY,
          children: childNodes.map(n => ({ cx: n.x + NODE_W / 2, y: n.y })),
        }
        for (const e of childEdges) edgesToRemove.add(e.id)
      }
    }

    const filteredEdges = [...edges, ...extraEdges].filter(e => !edgesToRemove.has(e.id))

    return {
      allNodes: [...nodes, ...extraNodes],
      allEdges: filteredEdges,
      familyConnector,
      parentCoupleConnectors,
    }
  }, [nodes, edges, graph, personId, mode])

  const allNodeMap = useMemo(() => {
    const m = new Map()
    allNodes.forEach(n => m.set(n.id, n))
    return m
  }, [allNodes])

  // ─── Fit-to-screen ─────────────────────────────────────
  useEffect(() => {
    if (!allNodes.length || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const W = rect.width  || 800
    const H = rect.height || 500

    const xs = allNodes.map(n => n.x)
    const ys = allNodes.map(n => n.y)
    const minX  = Math.min(...xs)
    const minY  = Math.min(...ys)
    const treeW = Math.max(...xs) + NODE_W - minX
    const treeH = Math.max(...ys) + NODE_H - minY

    const s = Math.min(1, (W - 48) / (treeW || 1), (H - 48) / (treeH || 1))
    setPan({
      x: (W - treeW * s) / 2 - minX * s,
      y: (H - treeH * s) / 2 - minY * s,
    })
    setScale(s)
  }, [allNodes])

  // ─── Pan/zoom-hendlere ─────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect   = containerRef.current?.getBoundingClientRect()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => {
      const next = Math.min(3, Math.max(0.15, prev * factor))
      if (rect) {
        // Zoom mot musepekeren
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        setPan(p => ({
          x: mx - (mx - p.x) * (next / prev),
          y: my - (my - p.y) * (next / prev),
        }))
      }
      return next
    })
  }, [])

  // Non-passive wheel-lytter for å støtte e.preventDefault() (scroll-zoom)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const startDrag = useCallback((e) => {
    if (e.button !== 0) return
    isDragging.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    lastPointer.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const stopDrag = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleNodeNavigate = useCallback((id) => {
    setSearchParams({ person: id, mode })
  }, [mode, setSearchParams])

  const handleOpenProfile = useCallback((id) => {
    navigate(`/person/${id}`)
  }, [navigate])

  function applyZoom(factor) {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width  / 2
    const cy = rect.height / 2
    setScale(prev => {
      const next = Math.min(3, Math.max(0.15, prev * factor))
      setPan(p => ({
        x: cx - (cx - p.x) * (next / prev),
        y: cy - (cy - p.y) * (next / prev),
      }))
      return next
    })
  }

  function resetZoom() {
    if (!allNodes.length || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const W = rect.width  || 800
    const H = rect.height || 500
    const xs = allNodes.map(n => n.x)
    const ys = allNodes.map(n => n.y)
    const minX  = Math.min(...xs)
    const minY  = Math.min(...ys)
    const treeW = Math.max(...xs) + NODE_W - minX
    const treeH = Math.max(...ys) + NODE_H - minY
    const s = Math.min(1, (W - 48) / (treeW || 1), (H - 48) / (treeH || 1))
    setPan({ x: (W - treeW * s) / 2 - minX * s, y: (H - treeH * s) / 2 - minY * s })
    setScale(s)
  }

  // ─── Fokusperson-info ───────────────────────────────────
  const focusInfo = graph?.infoMap?.get(personId)
  const focusName = focusInfo
    ? [focusInfo.givenName, focusInfo.surname].filter(Boolean).join(' ')
    : personId

  // ─── Render ─────────────────────────────────────────────
  if (graphLoading) {
    return <Layout><LoadingSpinner fullPage text="Laster familiegraf…" /></Layout>
  }

  if (!personId) {
    return (
      <Layout>
        <div className="page-container" style={{ textAlign: 'center', paddingTop: 'var(--space-16)' }}>
          <p className="text-muted">
            Ingen person valgt. Gå til en{' '}
            <Link to="/søk" className="text-accent">personside</Link> og klikk
            «Vis i familietre».
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Topbar */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             'var(--space-2)',
        padding:         '8px 16px',
        borderBottom:    '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg)',
        flexShrink:      0,
        flexWrap:        'wrap',
        position:        'sticky',
        top:             0,
        zIndex:          10,
      }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0 }}
        >
          ← Tilbake
        </button>

        <Link
          to={`/person/${personId}`}
          style={{
            fontFamily:     'var(--font-heading)',
            fontSize:       'var(--text-md)',
            color:          'var(--color-text)',
            textDecoration: 'none',
            flexGrow:       1,
            minWidth:       0,
            overflow:       'hidden',
            textOverflow:   'ellipsis',
            whiteSpace:     'nowrap',
          }}
        >
          {focusName}
        </Link>

        {/* Modus-velger */}
        <div style={{
          display:      'flex',
          border:       '1px solid var(--color-border)',
          borderRadius: '6px',
          overflow:     'hidden',
          flexShrink:   0,
        }}>
          {[
            ['aner',          'Aner'],
            ['etterkommere',  'Etterkommere'],
            ['begge',         'Begge'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSearchParams({ person: personId, mode: val })}
              style={{
                padding:         '4px 12px',
                fontSize:        'var(--text-sm)',
                border:          'none',
                borderRight:     val !== 'begge' ? '1px solid var(--color-border)' : 'none',
                cursor:          'pointer',
                backgroundColor: mode === val ? 'var(--color-accent)' : 'transparent',
                color:           mode === val ? '#fff' : 'var(--color-text)',
                fontFamily:      'var(--font-body)',
                transition:      'background-color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Generasjonsdybde */}
        <select
          value={maxGen}
          onChange={e => setMaxGen(Number(e.target.value))}
          style={{
            padding:         '4px 8px',
            fontSize:        'var(--text-sm)',
            border:          '1px solid var(--color-border)',
            borderRadius:    '6px',
            backgroundColor: 'var(--color-bg)',
            color:           'var(--color-text)',
            fontFamily:      'var(--font-body)',
            cursor:          'pointer',
            flexShrink:      0,
          }}
        >
          <option value={3}>3 gen</option>
          <option value={4}>4 gen</option>
          <option value={5}>5 gen</option>
        </select>

        <button onClick={resetZoom} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
          Tilpass
        </button>
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => applyZoom(1.25)}
            style={{ padding: '4px 10px', fontSize: '16px', lineHeight: 1, border: 'none', borderRight: '1px solid var(--color-border)', cursor: 'pointer', background: 'transparent', color: 'var(--color-text)' }}
            title="Zoom inn"
          >+</button>
          <button
            onClick={() => applyZoom(0.8)}
            style={{ padding: '4px 10px', fontSize: '16px', lineHeight: 1, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--color-text)' }}
            title="Zoom ut"
          >−</button>
        </div>
      </div>

      {/* SVG-lerret */}
      <div
        ref={containerRef}
        style={{
          height:   'calc(100vh - 130px)',
          overflow: 'hidden',
          cursor:   'grab',
          position: 'relative',
          backgroundColor: 'var(--color-bg)',
        }}
        onPointerDown={startDrag}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
      >
        {allNodes.length === 0 ? (
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            height:         '100%',
          }}>
            <p className="text-muted">Ingen data å vise for denne personen.</p>
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            style={{ display: 'block', overflow: 'visible' }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {/* Kanter */}
              {allEdges.map(e => {
                const d = elbowPath(allNodeMap, e.fromId, e.toId)
                if (!d) return null
                const isSpouseEdge = e.edgeType === 'spouse'
                return (
                  <path
                    key={e.id}
                    d={d}
                    fill="none"
                    stroke={isSpouseEdge ? 'var(--color-accent)' : 'var(--color-border)'}
                    strokeWidth={1.5}
                    strokeDasharray={isSpouseEdge ? '4 3' : undefined}
                    strokeOpacity={isSpouseEdge ? 0.5 : 1}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}

              {/* Par-koblinger for alle foreldrepar i aner/sandglass */}
              {parentCoupleConnectors.map(({ id, leftCx, rightCx, midX, parentBottomY, junctionY, childCx, childTopY }) => (
                <path
                  key={id}
                  d={[
                    `M ${leftCx} ${parentBottomY} V ${junctionY}`,
                    `M ${rightCx} ${parentBottomY} V ${junctionY}`,
                    `M ${leftCx} ${junctionY} H ${rightCx}`,
                    `M ${midX} ${junctionY} V ${childTopY}`,
                  ].join(' ')}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* Familie-kobling: fokusperson + ektefelle → barn */}
              {(() => {
                if (!familyConnector) return null
                const { midX, coupleY, junctionY, children } = familyConnector
                const allCxs = [midX, ...children.map(c => c.cx)]
                const barLeft  = Math.min(...allCxs)
                const barRight = Math.max(...allCxs)
                const parts = [
                  `M ${midX} ${coupleY} V ${junctionY}`,
                  `M ${barLeft} ${junctionY} H ${barRight}`,
                ]
                for (const { cx, y } of children) {
                  parts.push(`M ${cx} ${junctionY} V ${y}`)
                }
                return (
                  <path
                    key="family-connector"
                    d={parts.join(' ')}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })()}

              {/* Noder */}
              {allNodes.map(n => (
                <TreeNode
                  key={n.id}
                  node={n}
                  focusPersonId={personId}
                  myPersonId={myPersonId}
                  onNavigate={handleNodeNavigate}
                  onOpenProfile={handleOpenProfile}
                />
              ))}
            </g>
          </svg>
        )}
      </div>
    </Layout>
  )
}
