<template>
  <div class="landing-erd" aria-hidden="true">
    <div class="landing-erd-stage">
      <div class="landing-erd-scene">
        <svg
          class="landing-erd-edges"
          :viewBox="`0 0 ${SCENE_W} ${SCENE_H}`"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            v-for="edge in drawnEdges"
            :key="edge.id"
            class="landing-erd-edge-group"
            :class="{ active: edge.active }"
          >
            <path
              class="landing-erd-edge"
              :class="{ 'is-dashed': edge.dashed }"
              :d="edge.path"
            />
            <path
              class="erd-flow-line landing-erd-flow"
              :class="{ 'is-fast': edge.active }"
              :d="edge.path"
            />
            <path class="landing-erd-bar" :d="edge.bar" />
            <path class="landing-erd-crow" :d="edge.crow" />
            <g
              class="landing-erd-label"
              :transform="`translate(${edge.labelX} ${edge.labelY})`"
            >
              <rect x="-18" y="-9" width="36" height="18" rx="9" />
              <text y="3.5" text-anchor="middle">1:N</text>
            </g>
          </g>
        </svg>

        <article
          v-for="table in tables"
          :key="table.id"
          class="table-node"
          :class="{
            dragging: pose[table.id].dragging,
            dimmed: scene.dimOthers && !pose[table.id].dragging,
            spotlight: pose[table.id].spotlight,
          }"
          :style="tableStyle(table.id)"
          :data-table="table.id"
        >
          <div class="table-head" :style="{ background: table.color }">
            <div class="table-head-main">
              <div class="table-head-logical">{{ table.logicalName }}</div>
              <div class="table-head-physical">{{ table.physicalName }}</div>
            </div>
          </div>
          <div class="table-grid" :style="gridStyle">
            <div class="col-head-row">
              <div class="col-drag-spacer" />
              <div class="col-head-label">키</div>
              <div class="col-head-label">컬럼</div>
              <div class="col-head-label col-attr">타입</div>
            </div>
            <div
              v-for="(col, colIdx) in table.columns"
              :key="col.id"
              class="col-row"
              :class="{
                pk: col.pk,
                fk: col.fk && !col.pk,
                'row-pulse': pose[table.id].pulseRow === colIdx,
              }"
              :data-row="col.pk ? 'pk' : col.fk ? 'fk' : 'col'"
            >
              <div class="col-drag-spacer" />
              <div class="col-keys">
                <span v-if="col.pk" class="key-badge key-pk">PK</span>
                <span v-if="col.fk" class="key-badge key-fk">FK</span>
              </div>
              <div class="col-names">
                <span class="col-logical">{{ col.logicalName }}</span>
                <span class="col-physical">{{ col.physicalName }}</span>
              </div>
              <span class="col-attr col-type">
                <span class="type-badge" :class="`type-badge-${col.tone}`">
                  <span class="type-badge-name">{{ col.type }}</span>
                  <template v-if="col.length">
                    <span class="type-badge-sep" aria-hidden="true">|</span>
                    <span class="type-badge-len">{{ col.length }}</span>
                  </template>
                </span>
              </span>
            </div>
          </div>
        </article>

        <!-- 드래그 커서 -->
        <div
          class="landing-erd-cursor"
          :class="{ visible: cursor.visible, grabbing: cursor.grabbing }"
          :style="cursorStyle"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              class="cursor-pointer"
              d="M5.5 3.5v14.2l3.4-3.3 2.1 5.1 2.2-.9-2.1-5.1h5.3L5.5 3.5Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'

const SCENE_W = 960
const SCENE_H = 640
const TABLE_W = 320
const CYCLE_MS = 26000

const gridStyle = {
  gridTemplateColumns: '28px 56px minmax(6.5rem, 1.1fr) 7.5rem',
  '--erd-cols': '28px 56px minmax(6.5rem, 1.1fr) 7.5rem',
}

type TableId = 'user' | 'order' | 'item'

const base = {
  user: { x: 40, y: 48 },
  order: { x: 540, y: 72 },
  item: { x: 100, y: 400 },
} as const

type Pose = {
  x: number
  y: number
  scale: number
  lift: number
  dragging: boolean
  spotlight: boolean
  pulseRow: number | null
}

const pose = reactive<Record<TableId, Pose>>({
  user: {
    x: 0,
    y: 0,
    scale: 1,
    lift: 0,
    dragging: false,
    spotlight: false,
    pulseRow: null,
  },
  order: {
    x: 0,
    y: 0,
    scale: 1,
    lift: 0,
    dragging: false,
    spotlight: false,
    pulseRow: null,
  },
  item: {
    x: 0,
    y: 0,
    scale: 1,
    lift: 0,
    dragging: false,
    spotlight: false,
    pulseRow: null,
  },
})

const scene = reactive({ dimOthers: false, activeEdge: '' as string })

const cursor = reactive({
  x: 0,
  y: 0,
  visible: false,
  grabbing: false,
  opacity: 0,
})

type DrawnEdge = {
  id: string
  path: string
  bar: string
  crow: string
  labelX: number
  labelY: number
  dashed: boolean
  active: boolean
}

const drawnEdges = ref<DrawnEdge[]>([])

const TABLE_HEAD_H = 52
const COL_HEAD_H = 32
const COL_H = 38
const TABLE_H = TABLE_HEAD_H + COL_HEAD_H + COL_H * 3

const rowCenterY = (colIndex: number) =>
  TABLE_HEAD_H + COL_HEAD_H + colIndex * COL_H + COL_H / 2

const ROW_Y = {
  user: { pk: rowCenterY(0), fk: rowCenterY(0) },
  order: { pk: rowCenterY(0), fk: rowCenterY(1) },
  item: { pk: rowCenterY(0), fk: rowCenterY(1) },
} as const

const tables = [
  {
    id: 'user' as const,
    logicalName: '사용자',
    physicalName: 'users',
    color: '#3b82f6',
    columns: [
      { id: 'u1', logicalName: '아이디', physicalName: 'id', type: 'INT', tone: 'id', pk: true, fk: false },
      { id: 'u2', logicalName: '이메일', physicalName: 'email', type: 'VARCHAR', length: '255', tone: 'text', pk: false, fk: false },
      { id: 'u3', logicalName: '이름', physicalName: 'name', type: 'VARCHAR', length: '100', tone: 'text', pk: false, fk: false },
    ],
  },
  {
    id: 'order' as const,
    logicalName: '주문',
    physicalName: 'orders',
    color: '#10b981',
    columns: [
      { id: 'o1', logicalName: '주문번호', physicalName: 'id', type: 'INT', tone: 'id', pk: true, fk: false },
      { id: 'o2', logicalName: '사용자', physicalName: 'user_id', type: 'INT', tone: 'id', pk: false, fk: true },
      { id: 'o3', logicalName: '상태', physicalName: 'status', type: 'VARCHAR', length: '32', tone: 'text', pk: false, fk: false },
    ],
  },
  {
    id: 'item' as const,
    logicalName: '주문상품',
    physicalName: 'order_items',
    color: '#f59e0b',
    columns: [
      { id: 'i1', logicalName: '아이디', physicalName: 'id', type: 'INT', tone: 'id', pk: true, fk: false },
      { id: 'i2', logicalName: '주문', physicalName: 'order_id', type: 'INT', tone: 'id', pk: false, fk: true },
      { id: 'i3', logicalName: '수량', physicalName: 'qty', type: 'INT', tone: 'int', pk: false, fk: false },
    ],
  },
]

const tableStyle = (id: TableId) => {
  const p = pose[id]
  const b = base[id]
  const shadowY = 10 + p.lift * 14
  const shadowBlur = 28 + p.lift * 24
  const shadowA = 0.06 + p.lift * 0.14
  return {
    width: `${TABLE_W}px`,
    left: `${b.x + p.x}px`,
    top: `${b.y + p.y}px`,
    zIndex: p.dragging ? 8 : p.spotlight ? 5 : id === 'order' ? 3 : id === 'user' ? 2 : 1,
    transform: `translateY(${-p.lift * 10}px) scale(${p.scale})`,
    transformOrigin: 'center center',
    boxShadow: p.dragging
      ? `0 ${shadowY}px ${shadowBlur}px rgb(25 31 40 / ${shadowA}), 0 0 0 3px rgb(79 70 229 / 0.3)`
      : `0 ${shadowY}px ${shadowBlur}px rgb(25 31 40 / ${shadowA})`,
  }
}

const cursorStyle = computed(() => ({
  left: `${cursor.x}px`,
  top: `${cursor.y}px`,
  opacity: cursor.opacity,
}))

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

const easeOutBack = (t: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** start~end 구간을 이징으로 0..1 */
const span = (
  t: number,
  start: number,
  end: number,
  ease: (u: number) => number = easeInOut,
) => {
  if (t <= start) return 0
  if (t >= end) return 1
  return ease((t - start) / (end - start))
}

const inRange = (t: number, a: number, b: number) => t >= a && t < b

type DragAct = {
  id: TableId
  /** 커서 등장 */
  appear: [number, number]
  /** 집기 */
  grab: [number, number]
  /** 이동 */
  move: [number, number]
  /** 놓기·정착 */
  drop: [number, number]
  /** 커서 퇴장 */
  leave: [number, number]
  to: { x: number; y: number }
  pulseSelf: number
  pulseOther: { id: TableId; row: number }
  edge: string
}

const acts: DragAct[] = [
  {
    id: 'user',
    appear: [0.04, 0.07],
    grab: [0.07, 0.1],
    move: [0.1, 0.22],
    drop: [0.22, 0.28],
    leave: [0.28, 0.32],
    to: { x: 64, y: 48 },
    pulseSelf: 0,
    pulseOther: { id: 'order', row: 1 },
    edge: 'user-order',
  },
  {
    id: 'order',
    appear: [0.36, 0.39],
    grab: [0.39, 0.42],
    move: [0.42, 0.54],
    drop: [0.54, 0.6],
    leave: [0.6, 0.64],
    to: { x: -72, y: 44 },
    pulseSelf: 0,
    pulseOther: { id: 'user', row: 0 },
    edge: 'user-order',
  },
  {
    id: 'item',
    appear: [0.68, 0.71],
    grab: [0.71, 0.74],
    move: [0.74, 0.86],
    drop: [0.86, 0.92],
    leave: [0.92, 0.96],
    to: { x: 56, y: -64 },
    pulseSelf: 1,
    pulseOther: { id: 'order', row: 0 },
    edge: 'order-item',
  },
]

const resetPose = (id: TableId) => {
  Object.assign(pose[id], {
    x: 0,
    y: 0,
    scale: 1,
    lift: 0,
    dragging: false,
    spotlight: false,
    pulseRow: null,
  })
}

const tableGrabPoint = (id: TableId, p: Pose) => ({
  x: base[id].x + p.x + TABLE_W * 0.62,
  y: base[id].y + p.y + 28,
})

const applyPose = (t: number) => {
  for (const id of ['user', 'order', 'item'] as TableId[]) resetPose(id)

  // 미세 idle 호흡 (드래그 중엔 덮어씀)
  const breath = (phase: number) => Math.sin((t * Math.PI * 2 + phase) * 2) * 2
  pose.user.y = breath(0)
  pose.order.y = breath(1.7)
  pose.item.y = breath(3.1)
  pose.user.lift = 0.04 + (Math.sin(t * Math.PI * 2) + 1) * 0.03
  pose.order.lift = 0.04 + (Math.sin(t * Math.PI * 2 + 1.2) + 1) * 0.03
  pose.item.lift = 0.04 + (Math.sin(t * Math.PI * 2 + 2.4) + 1) * 0.03

  scene.dimOthers = false
  scene.activeEdge = ''
  cursor.visible = false
  cursor.grabbing = false
  cursor.opacity = 0

  for (const act of acts) {
    const [a0, a1] = act.appear
    const [g0, g1] = act.grab
    const [m0, m1] = act.move
    const [d0, d1] = act.drop
    const [l0, l1] = act.leave
    if (t < a0 || t >= l1) continue

    const p = pose[act.id]
    scene.dimOthers = inRange(t, g0, d1)
    scene.activeEdge = inRange(t, m0, l0) ? act.edge : ''

    // 관계 컬럼 펄스
    if (inRange(t, g0, d1)) {
      p.pulseRow = act.pulseSelf
      pose[act.pulseOther.id].pulseRow = act.pulseOther.row
      pose[act.pulseOther.id].spotlight = true
    }

    // 커서 등장 → 테이블 헤드로
    const home = tableGrabPoint(act.id, { ...p, x: 0, y: breath(act.id === 'user' ? 0 : act.id === 'order' ? 1.7 : 3.1) })
    const offscreen = { x: home.x + 80, y: home.y - 70 }

    if (inRange(t, a0, g0)) {
      const u = span(t, a0, a1, easeOutCubic)
      cursor.visible = true
      cursor.opacity = u
      cursor.x = lerp(offscreen.x, home.x, u)
      cursor.y = lerp(offscreen.y, home.y, u)
      p.spotlight = u > 0.4
    }

    if (inRange(t, g0, m0)) {
      const u = span(t, g0, g1, easeOutCubic)
      cursor.visible = true
      cursor.opacity = 1
      cursor.grabbing = u > 0.35
      cursor.x = home.x
      cursor.y = home.y
      p.spotlight = true
      p.dragging = u > 0.5
      p.lift = lerp(0.08, 1, u)
      p.scale = lerp(1, 1.055, u)
      // 살짝 집어 올림
      p.y = breath(0) + lerp(0, -8, u)
    }

    if (inRange(t, m0, d0)) {
      const u = span(t, m0, m1, easeInOut)
      // 이동 경로에 약간의 아크
      const arc = Math.sin(u * Math.PI) * 14
      p.x = lerp(0, act.to.x, u)
      p.y = lerp(-8, act.to.y, u) - arc
      p.dragging = true
      p.spotlight = true
      p.lift = 1
      p.scale = 1.055
      const gp = tableGrabPoint(act.id, p)
      cursor.visible = true
      cursor.opacity = 1
      cursor.grabbing = true
      cursor.x = gp.x + 6
      cursor.y = gp.y + 4
    }

    if (inRange(t, d0, l0)) {
      const u = span(t, d0, d1, easeOutBack)
      const settle = span(t, d0, d1, easeOutCubic)
      p.x = lerp(act.to.x, 0, u)
      p.y = lerp(act.to.y, 0, u)
      p.dragging = settle < 0.85
      p.spotlight = true
      p.lift = lerp(1, 0.06, settle)
      p.scale = lerp(1.055, 1, settle)
      // 드롭 순간 작은 찌그러짐
      if (settle > 0.15 && settle < 0.45) {
        p.scale = lerp(1.055, 0.985, (settle - 0.15) / 0.3)
      }
      const gp = tableGrabPoint(act.id, p)
      cursor.visible = true
      cursor.opacity = 1
      cursor.grabbing = settle < 0.55
      cursor.x = gp.x
      cursor.y = gp.y
    }

    if (inRange(t, l0, l1)) {
      const u = span(t, l0, l1, easeInOut)
      p.spotlight = u < 0.5
      cursor.visible = true
      cursor.grabbing = false
      cursor.opacity = 1 - u
      const gp = tableGrabPoint(act.id, p)
      cursor.x = lerp(gp.x, gp.x + 50, u)
      cursor.y = lerp(gp.y, gp.y + 60, u)
    }
  }
}

type Side = 'left' | 'right'

const layoutLeft = (id: TableId) => base[id].x + pose[id].x
const layoutTop = (id: TableId) => base[id].y + pose[id].y

/**
 * CSS: translateY(-lift*10) scale — origin center.
 * 관계선은 스케일·리프트 반영한 시각 가장자리에 붙임.
 */
const visualPoint = (id: TableId, localX: number, localY: number) => {
  const p = pose[id]
  const left = layoutLeft(id)
  const top = layoutTop(id)
  const s = p.scale
  const cx = left + TABLE_W / 2
  const cy = top + TABLE_H / 2
  return {
    x: cx + (localX - TABLE_W / 2) * s,
    y: cy + (localY - TABLE_H / 2) * s - p.lift * 10,
  }
}

const tableLeft = (id: TableId) => visualPoint(id, 0, TABLE_H / 2).x
const tableRight = (id: TableId) => visualPoint(id, TABLE_W, TABLE_H / 2).x
const tableTop = (id: TableId) => visualPoint(id, TABLE_W / 2, 0).y
const tableBottom = (id: TableId) => visualPoint(id, TABLE_W / 2, TABLE_H).y
const tableCenterX = (id: TableId) => (tableLeft(id) + tableRight(id)) / 2

const intervalGap = (a0: number, a1: number, b0: number, b1: number) => {
  if (a1 < b0) return b0 - a1
  if (b1 < a0) return a0 - b1
  return 0
}

/** 세로 레인(x)이 다른 테이블 위를 지나가면 패널티 */
const laneHitsTable = (laneX: number, y0: number, y1: number, id: TableId) => {
  const top = Math.min(y0, y1)
  const bot = Math.max(y0, y1)
  if (bot < tableTop(id) - 4 || top > tableBottom(id) + 4) return false
  return laneX >= tableLeft(id) - 12 && laneX <= tableRight(id) + 12
}

const pickSides = (
  from: TableId,
  to: TableId,
  avoid: TableId[] = [],
): { source: Side; target: Side } => {
  const ax = tableLeft(from)
  const bx = tableLeft(to)
  const ar = tableRight(from)
  const br = tableRight(to)
  const ay = tableTop(from)
  const by = tableTop(to)
  const ab = tableBottom(from)
  const bb = tableBottom(to)
  const gx = intervalGap(ax, ar, bx, br)
  const gy = intervalGap(ay, ab, by, bb)

  const sy = visualPoint(from, TABLE_W / 2, ROW_Y[from].pk).y
  const ty = visualPoint(to, TABLE_W / 2, ROW_Y[to].fk).y

  const scoreSide = (side: Side) => {
    const fromX = side === 'right' ? ar : ax
    const toX = side === 'right' ? br : bx
    const lane = side === 'right' ? Math.max(ar, br) + 56 : Math.min(ax, bx) - 56
    let score = Math.abs(fromX - toX) + Math.abs(sy - ty)
    for (const id of avoid) {
      if (laneHitsTable(lane, sy, ty, id)) score += 5000
    }
    if (side === 'left' && avoid.length) score += 120
    return score
  }

  if (gy >= gx) {
    const side: Side = scoreSide('left') < scoreSide('right') ? 'left' : 'right'
    return { source: side, target: side }
  }

  if (tableCenterX(from) <= tableCenterX(to)) {
    return { source: 'right', target: 'left' }
  }
  return { source: 'left', target: 'right' }
}

const anchor = (id: TableId, row: 'pk' | 'fk', side: Side) => {
  const localX = side === 'right' ? TABLE_W : 0
  const localY = ROW_Y[id][row]
  const { x, y } = visualPoint(id, localX, localY)
  return { x, y, side }
}

const STUB = 36

/** 가로 구간이 테이블 몸통을 가로지르면 true */
const hSegHitsTable = (x0: number, x1: number, y: number, id: TableId) => {
  if (y < tableTop(id) - 6 || y > tableBottom(id) + 6) return false
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  return lo < tableRight(id) - 8 && hi > tableLeft(id) + 8
}

const orthoPath = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sSide: Side,
  tSide: Side,
  from: TableId,
  to: TableId,
  avoid: TableId[] = [],
) => {
  const obstacles = [...new Set([...avoid, from, to])]
  const clearRight =
    Math.max(tableRight(from), tableRight(to), ...avoid.map((id) => tableRight(id))) +
    56
  const clearLeft =
    Math.min(tableLeft(from), tableLeft(to), ...avoid.map((id) => tableLeft(id))) -
    56

  const laneClear = (lane: number, y0: number, y1: number) =>
    !obstacles.some((id) => laneHitsTable(lane, y0, y1, id))

  // 같은 면 우회 — 테이블을 가로로 뚫지 않음
  const sameSideRoute = (side: Side) => {
    const lane = side === 'right' ? clearRight : clearLeft
    const safe = laneClear(lane, sy, ty)
      ? lane
      : side === 'right'
        ? clearRight
        : clearLeft
    return { d: `M${sx} ${sy} H${safe} V${ty} H${tx}`, labelX: safe }
  }

  if (sSide === tSide) return sameSideRoute(sSide)

  const sExit = sSide === 'right' ? sx + STUB : sx - STUB
  const tExit = tSide === 'right' ? tx + STUB : tx - STUB

  if (sSide === 'right' && tSide === 'left') {
    if (sExit + 16 <= tExit) {
      const mid = (sExit + tExit) / 2
      if (laneClear(mid, sy, ty)) {
        return { d: `M${sx} ${sy} H${mid} V${ty} H${tx}`, labelX: mid }
      }
    }
    return sameSideRoute('right')
  }

  // left → right: 가운데 세로가 비면 쓰고, 아니면 오른쪽 같은 면으로
  if (tExit + 16 <= sExit) {
    const mid = (sExit + tExit) / 2
    const crosses =
      hSegHitsTable(sx, mid, sy, from) ||
      hSegHitsTable(mid, tx, ty, to) ||
      obstacles.some((id) => laneHitsTable(mid, sy, ty, id))
    if (!crosses) {
      return { d: `M${sx} ${sy} H${mid} V${ty} H${tx}`, labelX: mid }
    }
  }

  // 반대 면끼리인데 우회가 테이블을 관통하면 → 앵커를 오른쪽 같은 면처럼 재라우팅
  // (왼쪽 출발 → 오른쪽 레인 H 는 주문 테이블을 뚫음)
  if (
    hSegHitsTable(sExit, clearRight, sy, from) ||
    hSegHitsTable(sExit, clearLeft, sy, from)
  ) {
    const rsx = tableRight(from)
    const rtx = tableRight(to)
    return {
      d: `M${rsx} ${sy} H${clearRight} V${ty} H${rtx}`,
      labelX: clearRight,
    }
  }

  return sameSideRoute('right')
}

const crowPath = (tx: number, ty: number, side: Side) => {
  const dir = side === 'left' ? -1 : 1
  return `M${tx + dir * 10} ${ty - 8} L${tx} ${ty} L${tx + dir * 10} ${ty + 8} M${tx + dir * 6} ${ty - 5} L${tx} ${ty} L${tx + dir * 6} ${ty + 5}`
}

const barPath = (sx: number, sy: number) => `M${sx} ${sy - 6} V${sy + 6}`

const rebuildEdges = () => {
  const sidesA = pickSides('user', 'order')
  // 주문↔주문상품: 항상 오른쪽끼리 — 왼쪽 우회 후 테이블 관통 방지
  const sidesB: { source: Side; target: Side } = {
    source: 'right',
    target: 'right',
  }
  const uPk = anchor('user', 'pk', sidesA.source)
  const oFk = anchor('order', 'fk', sidesA.target)
  const oPk = anchor('order', 'pk', sidesB.source)
  const iFk = anchor('item', 'fk', sidesB.target)

  const pathA = orthoPath(
    uPk.x,
    uPk.y,
    oFk.x,
    oFk.y,
    uPk.side,
    oFk.side,
    'user',
    'order',
  )
  const pathB = orthoPath(
    oPk.x,
    oPk.y,
    iFk.x,
    iFk.y,
    oPk.side,
    iFk.side,
    'order',
    'item',
    ['user'],
  )

  const next: DrawnEdge[] = [
    {
      id: 'user-order',
      path: pathA.d,
      bar: barPath(uPk.x, uPk.y),
      crow: crowPath(oFk.x, oFk.y, oFk.side),
      labelX: pathA.labelX,
      labelY: (uPk.y + oFk.y) / 2,
      dashed: false,
      active: scene.activeEdge === 'user-order',
    },
    {
      id: 'order-item',
      path: pathB.d,
      bar: barPath(oPk.x, oPk.y),
      crow: crowPath(iFk.x, iFk.y, iFk.side),
      labelX: pathB.labelX,
      labelY: (oPk.y + iFk.y) / 2,
      dashed: true,
      active: scene.activeEdge === 'order-item',
    },
  ]

  if (drawnEdges.value.length !== next.length) {
    drawnEdges.value = next
    return
  }
  for (let i = 0; i < next.length; i++) {
    Object.assign(drawnEdges.value[i]!, next[i]!)
  }
}

let frame = 0
let start = 0
let reduced = false

const tick = (now: number) => {
  if (!start) start = now
  if (!reduced) {
    const t = ((now - start) % CYCLE_MS) / CYCLE_MS
    applyPose(t)
  }
  rebuildEdges()
  frame = requestAnimationFrame(tick)
}

onMounted(async () => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  applyPose(0)
  await nextTick()
  rebuildEdges()
  frame = requestAnimationFrame(tick)
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
})
</script>

<style scoped>
.landing-erd {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.landing-erd-stage {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.landing-erd-scene {
  position: absolute;
  right: 6%;
  top: 42%;
  width: 960px;
  height: 640px;
  overflow: visible;
  transform: translateY(-50%) scale(0.56);
  transform-origin: right center;
  transform-style: flat;
  animation: landing-erd-float 16s ease-in-out infinite;
}

.landing-erd-edges {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.landing-erd-edge-group {
  opacity: 0.72;
  transition: opacity 0.35s ease;
}

.landing-erd-edge-group.active {
  opacity: 1;
}

.landing-erd-edge {
  fill: none;
  stroke: var(--muted-foreground);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke 0.3s ease, stroke-width 0.3s ease;
}

.landing-erd-edge-group.active .landing-erd-edge {
  stroke: var(--primary);
  stroke-width: 1.85;
}

.landing-erd-edge.is-dashed {
  stroke-dasharray: 6 4;
}

.landing-erd-flow {
  opacity: 0.55;
}

.landing-erd-flow.is-fast {
  opacity: 1;
  animation-duration: 0.55s;
}

.landing-erd-bar,
.landing-erd-crow {
  fill: none;
  stroke: var(--muted-foreground);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke 0.3s ease;
}

.landing-erd-edge-group.active .landing-erd-bar,
.landing-erd-edge-group.active .landing-erd-crow {
  stroke: var(--primary);
}

.landing-erd-label {
  opacity: 0.85;
  transition: opacity 0.3s ease;
}

.landing-erd-edge-group.active .landing-erd-label {
  opacity: 1;
}

.landing-erd-edge-group.active .landing-erd-label rect {
  animation: landing-erd-label-glow 0.9s ease;
}

.landing-erd-label rect {
  fill: var(--card);
  filter: drop-shadow(0 4px 12px rgb(25 31 40 / 0.08));
}

.landing-erd-label text {
  fill: var(--muted-foreground);
  font-size: 11px;
  font-weight: 700;
  font-family: inherit;
}

.landing-erd-edge-group.active .landing-erd-label text {
  fill: #4f46e5;
}

.landing-erd-scene :deep(.table-node) {
  position: absolute;
  min-width: 0;
  z-index: 2;
  will-change: left, top, transform, box-shadow, opacity, filter;
  transition:
    opacity 0.35s ease,
    filter 0.35s ease;
}

.landing-erd-scene :deep(.table-node.dimmed) {
  opacity: 0.55;
  filter: saturate(0.85);
}

.landing-erd-scene :deep(.table-node.spotlight:not(.dragging)) {
  filter: saturate(1.05);
}

.landing-erd-scene :deep(.col-row.row-pulse) {
  background: color-mix(in srgb, #3182f6 12%, transparent);
  animation: landing-erd-row-pulse 1.1s ease-in-out infinite;
}

.landing-erd-scene :deep(.type-badge) {
  max-width: none;
}

.landing-erd-scene :deep(.type-badge-name),
.landing-erd-scene :deep(.type-badge-len) {
  overflow: visible;
  text-overflow: clip;
}

.landing-erd-cursor {
  position: absolute;
  z-index: 20;
  width: 28px;
  height: 28px;
  margin-left: -4px;
  margin-top: -2px;
  color: #1c1917;
  pointer-events: none;
  filter: drop-shadow(0 6px 10px rgb(25 31 40 / 0.28));
  transition: color 0.15s ease;
  will-change: left, top, opacity, transform;
}

.dark .landing-erd-cursor {
  color: #e8eaed;
}

.landing-erd-cursor.grabbing {
  color: #4f46e5;
  transform: rotate(-8deg) scale(0.92);
}

.landing-erd-cursor .cursor-pointer {
  transform-origin: 5px 3px;
}

@keyframes landing-erd-float {
  0%,
  100% {
    transform: translateY(-50%) scale(0.56);
  }
  35% {
    transform: translateY(calc(-50% - 5px)) scale(0.56);
  }
  70% {
    transform: translateY(calc(-50% - 2px)) scale(0.56);
  }
}

@keyframes landing-erd-row-pulse {
  0%,
  100% {
    background: color-mix(in srgb, #3182f6 10%, transparent);
  }
  50% {
    background: color-mix(in srgb, #3182f6 22%, transparent);
  }
}

@keyframes landing-erd-label-glow {
  0%,
  100% {
    filter: drop-shadow(0 4px 12px rgb(25 31 40 / 0.08));
  }
  40% {
    filter: drop-shadow(0 4px 16px rgb(79 70 229 / 0.35));
  }
}

@media (max-width: 639px) {
  .landing-erd-scene {
    right: 2%;
    top: 48%;
    transform: translateY(-40%) scale(0.42);
    transform-origin: 75% center;
  }

  .landing-erd-cursor {
    display: none;
  }

  @keyframes landing-erd-float {
    0%,
    100% {
      transform: translateY(-40%) scale(0.42);
    }
    50% {
      transform: translateY(calc(-40% - 4px)) scale(0.42);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-erd-scene {
    animation: none;
  }

  .landing-erd-scene :deep(.erd-flow-line),
  .landing-erd-scene :deep(.col-row.row-pulse) {
    animation: none;
  }

  .landing-erd-cursor {
    display: none;
  }
}
</style>
