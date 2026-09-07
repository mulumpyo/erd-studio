import {
  COLUMN_TYPES,
  TABLE_COLORS,
  createId,
  defaultColumn,
  defaultTable,
  defaultViewSettings,
  emptyDocument,
  normalizeDocument,
  pkColumn,
  type ErdDocument,
  type ErdRelation,
  type ErdTable,
} from '@erd-studio/shared'

const MAX_TABLES = 20

const KNOWN: Array<{
  match: RegExp
  build: () => ErdDocument
}> = [
  {
    match: /블로그|blog|게시|포스트|댓글/,
    build: () => blogDoc(),
  },
  {
    match: /쇼핑몰|커머스|주문|상품|장바구니|shop|commerce|order|product/,
    build: () => shopDoc(),
  },
  {
    match: /팀|프로젝트|멤버|초대|saas|workspace/,
    build: () => teamDoc(),
  },
]

const WORD_MAP: Record<string, string> = {
  사용자: 'users',
  유저: 'users',
  회원: 'members',
  글: 'posts',
  게시글: 'posts',
  포스트: 'posts',
  댓글: 'comments',
  상품: 'products',
  제품: 'products',
  주문: 'orders',
  주문상세: 'order_items',
  주문항목: 'order_items',
  카테고리: 'categories',
  팀: 'teams',
  프로젝트: 'projects',
  멤버: 'members',
  초대: 'invitations',
  태그: 'tags',
  알림: 'notifications',
  파일: 'files',
  결제: 'payments',
  리뷰: 'reviews',
  주소: 'addresses',
}

const toPhysical = (label: string) => {
  const trimmed = label.trim()
  if (!trimmed) return 'table'
  const mapped = WORD_MAP[trimmed]
  if (mapped) return mapped
  if (/^[a-zA-Z][\w]*$/.test(trimmed)) return trimmed.toLowerCase()
  // Hangul syllables must not go through NFKD (jamo fall outside 가-힣).
  if (/[가-힣]/.test(trimmed)) {
    return (
      trimmed
        .replace(/[^\w가-힣]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'table'
    )
  }
  return (
    trimmed
      .normalize('NFKD')
      .replace(/[^\w]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'table'
  )
}

const place = (index: number) => ({
  x: 80 + (index % 3) * 280,
  y: 80 + Math.floor(index / 3) * 220,
})

const tableOf = (
  logical: string,
  physical: string,
  index: number,
  extraCols: ReturnType<typeof defaultColumn>[] = [],
): ErdTable =>
  defaultTable({
    id: createId('tbl'),
    logicalName: logical,
    physicalName: physical,
    color: TABLE_COLORS[index % TABLE_COLORS.length],
    position: place(index),
    columns: [pkColumn(), ...extraCols],
  })

const nameCol = () =>
  defaultColumn({
    logicalName: '이름',
    physicalName: 'name',
    type: 'varchar',
    length: '120',
    nn: true,
  })

const fkCol = (logical: string, physical: string) =>
  defaultColumn({
    logicalName: logical,
    physicalName: physical,
    type: 'int',
    length: undefined,
    fk: true,
    nn: true,
  })

const link = (
  source: ErdTable,
  target: ErdTable,
  sourceCol: string,
  targetCol = 'id',
): ErdRelation => ({
  id: createId('rel'),
  sourceTableId: source.id,
  targetTableId: target.id,
  sourceColumnIds: [sourceCol],
  targetColumnIds: [
    target.columns.find((c) => c.physicalName === targetCol)?.id ||
      target.columns[0]!.id,
  ],
  kind: 'non-identifying',
  sourceCardinality: 'N',
  targetCardinality: '1',
})

const wrap = (tables: ErdTable[], relations: ErdRelation[]): ErdDocument =>
  normalizeDocument({
    ...emptyDocument(),
    tables,
    relations,
    settings: defaultViewSettings(),
  })

const blogDoc = (): ErdDocument => {
  const users = tableOf('사용자', 'users', 0, [
    nameCol(),
    defaultColumn({
      logicalName: '이메일',
      physicalName: 'email',
      type: 'varchar',
      length: '255',
      nn: true,
      unique: true,
    }),
  ])
  const posts = tableOf('게시글', 'posts', 1, [
    fkCol('작성자', 'user_id'),
    defaultColumn({
      logicalName: '제목',
      physicalName: 'title',
      type: 'varchar',
      length: '200',
      nn: true,
    }),
    defaultColumn({
      logicalName: '본문',
      physicalName: 'body',
      type: 'text',
      length: undefined,
    }),
  ])
  const comments = tableOf('댓글', 'comments', 2, [
    fkCol('게시글', 'post_id'),
    fkCol('작성자', 'user_id'),
    defaultColumn({
      logicalName: '내용',
      physicalName: 'body',
      type: 'text',
      length: undefined,
      nn: true,
    }),
  ])
  const userId = users.columns.find((c) => c.physicalName === 'id')!.id
  const postId = posts.columns.find((c) => c.physicalName === 'id')!.id
  const postsUser = posts.columns.find((c) => c.physicalName === 'user_id')!.id
  const commentsPost = comments.columns.find(
    (c) => c.physicalName === 'post_id',
  )!.id
  const commentsUser = comments.columns.find(
    (c) => c.physicalName === 'user_id',
  )!.id
  return wrap(
    [users, posts, comments],
    [
      {
        ...link(posts, users, postsUser),
        sourceColumnIds: [postsUser],
        targetColumnIds: [userId],
      },
      {
        ...link(comments, posts, commentsPost),
        sourceColumnIds: [commentsPost],
        targetColumnIds: [postId],
      },
      {
        ...link(comments, users, commentsUser),
        sourceColumnIds: [commentsUser],
        targetColumnIds: [userId],
      },
    ],
  )
}

const shopDoc = (): ErdDocument => {
  const users = tableOf('사용자', 'users', 0, [
    nameCol(),
    defaultColumn({
      logicalName: '이메일',
      physicalName: 'email',
      type: 'varchar',
      length: '255',
      nn: true,
      unique: true,
    }),
  ])
  const products = tableOf('상품', 'products', 1, [
    nameCol(),
    defaultColumn({
      logicalName: '가격',
      physicalName: 'price',
      type: 'decimal',
      length: '12,2',
      nn: true,
    }),
  ])
  const orders = tableOf('주문', 'orders', 2, [
    fkCol('주문자', 'user_id'),
    defaultColumn({
      logicalName: '상태',
      physicalName: 'status',
      type: 'varchar',
      length: '40',
      nn: true,
    }),
  ])
  const items = tableOf('주문항목', 'order_items', 3, [
    fkCol('주문', 'order_id'),
    fkCol('상품', 'product_id'),
    defaultColumn({
      logicalName: '수량',
      physicalName: 'quantity',
      type: 'int',
      length: undefined,
      nn: true,
    }),
  ])
  const userId = users.columns.find((c) => c.physicalName === 'id')!.id
  const productId = products.columns.find((c) => c.physicalName === 'id')!.id
  const orderId = orders.columns.find((c) => c.physicalName === 'id')!.id
  const ordersUser = orders.columns.find((c) => c.physicalName === 'user_id')!.id
  const itemsOrder = items.columns.find((c) => c.physicalName === 'order_id')!.id
  const itemsProduct = items.columns.find(
    (c) => c.physicalName === 'product_id',
  )!.id
  return wrap(
    [users, products, orders, items],
    [
      {
        ...link(orders, users, ordersUser),
        sourceColumnIds: [ordersUser],
        targetColumnIds: [userId],
      },
      {
        ...link(items, orders, itemsOrder),
        sourceColumnIds: [itemsOrder],
        targetColumnIds: [orderId],
      },
      {
        ...link(items, products, itemsProduct),
        sourceColumnIds: [itemsProduct],
        targetColumnIds: [productId],
      },
    ],
  )
}

const teamDoc = (): ErdDocument => {
  const teams = tableOf('팀', 'teams', 0, [nameCol()])
  const projects = tableOf('프로젝트', 'projects', 1, [
    fkCol('팀', 'team_id'),
    nameCol(),
  ])
  const members = tableOf('멤버', 'members', 2, [
    fkCol('팀', 'team_id'),
    nameCol(),
    defaultColumn({
      logicalName: '역할',
      physicalName: 'role',
      type: 'varchar',
      length: '40',
      nn: true,
    }),
  ])
  const teamId = teams.columns.find((c) => c.physicalName === 'id')!.id
  const projectsTeam = projects.columns.find(
    (c) => c.physicalName === 'team_id',
  )!.id
  const membersTeam = members.columns.find(
    (c) => c.physicalName === 'team_id',
  )!.id
  return wrap(
    [teams, projects, members],
    [
      {
        ...link(projects, teams, projectsTeam),
        sourceColumnIds: [projectsTeam],
        targetColumnIds: [teamId],
      },
      {
        ...link(members, teams, membersTeam),
        sourceColumnIds: [membersTeam],
        targetColumnIds: [teamId],
      },
    ],
  )
}

const extractLabels = (prompt: string): string[] => {
  const cleaned = prompt
    .replace(/^(만들|생성|그려|설계|스키마|erd|다이어그램)[^\w가-힣]*/gi, '')
    .trim()
  const parts = cleaned
    .split(/[,，、\n+/]+|\s+와\s+|\s+과\s+|\s+및\s+|\s+and\s+|&/i)
    .map((part) => part.replace(/[:：].*$/, '').trim())
    .filter((part) => part.length >= 1 && part.length <= 40)
  const unique: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const key = toPhysical(part)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(part)
    if (unique.length >= MAX_TABLES) break
  }
  return unique
}

const fromLabels = (labels: string[]): ErdDocument => {
  const tables = labels.map((label, index) =>
    tableOf(label, toPhysical(label), index, [nameCol()]),
  )
  return wrap(tables, [])
}

const sanitizeGenerated = (raw: unknown): ErdDocument => {
  const doc = normalizeDocument(raw)
  if (!doc.tables.length) {
    throw new Error('생성된 다이어그램에 테이블이 없어요.')
  }
  doc.tables = doc.tables.slice(0, MAX_TABLES).map((table, index) => ({
    ...table,
    position:
      table.position?.x || table.position?.y ? table.position : place(index),
    color: table.color || TABLE_COLORS[index % TABLE_COLORS.length],
    columns: (table.columns?.length ? table.columns : [pkColumn()]).map(
      (col) => ({
        ...col,
        type: COLUMN_TYPES.includes(col.type as (typeof COLUMN_TYPES)[number])
          ? col.type
          : 'varchar',
      }),
    ),
  }))
  const tableIds = new Set(doc.tables.map((t) => t.id))
  doc.relations = doc.relations.filter(
    (rel) =>
      tableIds.has(rel.sourceTableId) && tableIds.has(rel.targetTableId),
  )
  return doc
}

/** Key 없이도 데모 가능한 로컬 초안 생성기 */
export const generateErdLocally = (prompt: string): ErdDocument => {
  const text = prompt.trim()
  const labels = extractLabels(text)
  if (labels.length >= 2) return fromLabels(labels)
  for (const known of KNOWN) {
    if (known.match.test(text)) return known.build()
  }
  if (labels.length === 1) return fromLabels(labels)
  return blogDoc()
}

export const sanitizeAiDocument = sanitizeGenerated
