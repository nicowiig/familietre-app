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

/** Elbow-sti fra øvre nodes bunn-senter → nedre nodes topp-senter. */
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
  if (gap < 2) return ''

  const midY = uy + gap / 2
  return `M ${ux} ${uy} V ${midY} H ${lx} V ${ly}`
}

// ─── TreeNode ────────────────────────────────────────────

function TreeNode({ node, focusPersonId, myPersonId, onNavigate }) {
  const isFocus = node.id === focusPersonId
  const isMe    = node.id === myPersonId

  const name  = [node.givenName, node.surname].filter(Boolean).join(' ') || 'Ukjent'
  let   years = ''
  if (node.birthYear && node.deathYear) years = `${node.birthYear} – ${node.deathYear}`
  else if (node.birthYear) years = `f. ${node.birthYear}`
  else if (node.deathYear) years = `d. ${node.deathYear}`

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
          width:           NODE_W + 'px',
          height:          NODE_H + 'px',
          boxSizing:       'border-box',
          border:          isFocus
            ? '2px solid var(--color-accent)'
            : '1px solid var(--color-border)',
          borderRadius:    '6px',
          backgroundColor: isMe
            ? 'rgba(122, 58, 26, 0.09)'
            : 'var(--color-bg, #f7f3ec)',
          cursor:          'pointer',
          padding:         '8px 10px',
          overflow:        'hidden',
          display:         'flex',
          flexDirection:   'column',
          justifyContent:  'center',
          userSelect:      'none',
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

  // ─── Fit-to-screen ─────────────────────────────────────
  useEffect(() => {
    if (!nodes.length || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const W = rect.width  || 800
    const H = rect.height || 500

    const xs = nodes.map(n => n.x)
    const ys = nodes.map(n => n.y)
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
  }, [nodes, personId, mode, maxGen])

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
    navigate(`/person/${id}`)
  }, [navigate])

  function resetZoom() {
    if (!nodes.length || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const W = rect.width  || 800
    const H = rect.height || 500
    const xs = nodes.map(n => n.x)
    const ys = nodes.map(n => n.y)
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

        <button
          onClick={resetZoom}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0 }}
        >
          Reset zoom
        </button>
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
        {nodes.length === 0 ? (
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
              {edges.map(e => {
                const d = elbowPath(nodeMap, e.fromId, e.toId)
                if (!d) return null
                return (
                  <path
                    key={e.id}
                    d={d}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}

              {/* Noder */}
              {nodes.map(n => (
                <TreeNode
                  key={n.id}
                  node={n}
                  focusPersonId={personId}
                  myPersonId={myPersonId}
                  onNavigate={handleNodeNavigate}
                />
              ))}
            </g>
          </svg>
        )}
      </div>
    </Layout>
  )
}
