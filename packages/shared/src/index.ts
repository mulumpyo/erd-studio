import { defaultViewSettings, type NameMode } from './view-settings'
import { createId } from './ids'
import { ensureDocumentIds } from './migrate-document'
import type {
  ErdColumn,
  ErdDocument,
  ErdDomain,
  ErdNote,
  ErdTable,
} from './erd-types'

export type {
  Cardinality,
  ErdColumn,
  ErdDocument,
  ErdDomain,
  ErdNote,
  ErdRelation,
  ErdSchema,
  ErdTable,
  RelationKind,
  SqlDialect,
  UserRole,
} from './erd-types'

export {
  REFERENTIAL_ACTIONS,
  normalizeReferentialAction,
  type ReferentialAction,
} from './referential'

export {
  type AccessMember,
  type AccessUser,
  type ProjectAccess,
  canDeleteProject,
  canEditProject,
  canManageMembers,
  canViewProject,
  findMembership,
  isProjectParticipant,
  isSameTenant,
  isTeamOwned,
  isTeamScoped,
} from './access'

export { createId, ensureStableId, fingerprint } from './ids'
export { ensureDocumentIds } from './migrate-document'
export {
  dialectDefaultSchemaName,
  ensureDocumentSchemas,
  makeSchema,
  schemaIdForName,
  type SchemaContext,
} from './schema'

export {
  ERD_FILE_KIND,
  ERD_FILE_VERSION,
  parseErdFile,
  stringifyErdFile,
  toErdFile,
  normalizeDocument,
  type ErdFile,
} from './erd-file'

export {
  emptyDatabaseModel,
  primaryKeyIdFor,
  toDatabaseModel,
  uniqueIndexIdFor,
  type DatabaseColumn,
  type DatabaseConstraint,
  type DatabaseDomain,
  type DatabaseForeignKey,
  type DatabaseIndex,
  type DatabaseModel,
  type DatabasePrimaryKey,
  type DatabaseSchema,
  type DatabaseTable,
} from './database-model'

export {
  documentFromDatabase,
  emptyCanvasModel,
  fromModels,
  toCanvasModel,
  type CanvasModel,
  type CanvasRelationLayout,
  type CanvasTableLayout,
  type CanvasViewport,
} from './canvas-model'

export {
  ERD_SHOW_OPTIONS,
  defaultShowFlags,
  defaultViewSettings,
  mergeViewSettings,
  normalizeViewSettings,
  viewHasExtraColumns,
  type ErdShowFlags,
  type ErdShowKey,
  type ErdViewPatch,
  type ErdViewSettings,
  type NameMode,
} from './view-settings'

export {
  VERSION_SNAPSHOT_KIND,
  captureVersionSnapshot,
  canvasFromVersionSnapshot,
  databaseModelFromVersionSnapshot,
  documentFromVersionSnapshot,
  isVersionSnapshot,
  normalizeVersionSnapshot,
  type VersionSnapshot,
} from './version-snapshot'

export const COLUMN_TYPES = [
  'int',
  'bigint',
  'smallint',
  'varchar',
  'char',
  'text',
  'boolean',
  'date',
  'datetime',
  'timestamp',
  'decimal',
  'float',
  'double',
  'json',
  'uuid',
  'blob',
] as const

export const TABLE_COLORS = [
  '#3b82f6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
] as const

export const emptyDocument = (): ErdDocument => ({
  schemas: [],
  tables: [],
  relations: [],
  notes: [],
  domains: [],
  settings: defaultViewSettings(),
})

export const defaultColumn = (partial?: Partial<ErdColumn>): ErdColumn => ({
  id: createId('col'),
  logicalName: '컬럼',
  physicalName: 'column',
  type: 'varchar',
  length: '255',
  pk: false,
  fk: false,
  nn: false,
  unique: false,
  autoIncrement: false,
  ...partial,
})

export const pkColumn = (): ErdColumn =>
  defaultColumn({
    logicalName: '아이디',
    physicalName: 'id',
    type: 'int',
    length: undefined,
    pk: true,
    nn: true,
    autoIncrement: true,
  })

export const columnRank = (col: Pick<ErdColumn, 'pk' | 'fk'>) => {
  if (col.pk) return 0
  if (col.fk) return 1
  return 2
}

export const orderTableColumns = <T extends Pick<ErdColumn, 'pk' | 'fk'>>(
  columns: T[],
): T[] =>
  columns
    .map((col, index) => ({ col, index }))
    .sort((a, b) => {
      const rank = columnRank(a.col) - columnRank(b.col)
      return rank !== 0 ? rank : a.index - b.index
    })
    .map((item) => item.col)

export const defaultTable = (partial?: Partial<ErdTable>): ErdTable => ({
  id: createId('tbl'),
  schemaId: '',
  logicalName: '새 테이블',
  physicalName: 'new_table',
  color: TABLE_COLORS[0],
  position: { x: 120, y: 120 },
  columns: [pkColumn()],
  ...partial,
})

export const defaultNote = (partial?: Partial<ErdNote>): ErdNote => ({
  id: createId('note'),
  text: '메모',
  color: '#fef3c7',
  position: { x: 80, y: 80 },
  width: 200,
  height: 120,
  ...partial,
})

export const defaultDomain = (partial?: Partial<ErdDomain>): ErdDomain => ({
  id: createId('dom'),
  name: '새 도메인',
  type: 'varchar',
  length: '255',
  nn: false,
  ...partial,
})

export const applyDomain = (
  col: ErdColumn,
  domain: ErdDomain | null | undefined,
): ErdColumn => {
  if (!domain) {
    const next = { ...col }
    delete next.domainId
    return next
  }
  return {
    ...col,
    domainId: domain.id,
    type: domain.type,
    length: domain.length,
    nn: domain.nn,
  }
}

export const columnTypeParts = (
  col: ErdColumn,
  domains: ErdDomain[] = [],
) => {
  const domain = col.domainId
    ? domains.find((item) => item.id === col.domainId)
    : undefined
  const type = String(domain?.type || col.type || '').trim()
  const length = String(domain?.length || col.length || '').trim()
  return {
    name: type.toUpperCase(),
    length: length || undefined,
    tone: columnTypeTone(type),
  }
}

export const columnTypeTone = (type: string) => {
  const t = type.trim().toLowerCase()
  if (t === 'int' || t === 'bigint' || t === 'smallint') return 'int'
  if (t === 'varchar' || t === 'char' || t === 'text') return 'text'
  if (t === 'boolean') return 'bool'
  if (t === 'date' || t === 'datetime' || t === 'timestamp') return 'date'
  if (t === 'decimal' || t === 'float' || t === 'double') return 'num'
  if (t === 'json') return 'json'
  if (t === 'uuid') return 'id'
  if (t === 'blob') return 'bin'
  return 'other'
}

export const columnTypeLabel = (
  col: ErdColumn,
  domains: ErdDomain[] = [],
) => {
  const { name, length } = columnTypeParts(col, domains)
  if (!name) return ''
  return length ? `${name}(${length})` : name
}

export const columnDomainLabel = (
  col: ErdColumn,
  domains: ErdDomain[] = [],
) => {
  if (!col.domainId) return ''
  return domains.find((item) => item.id === col.domainId)?.name ?? ''
}

export const displayNames = (
  logical: string,
  physical: string,
  mode: NameMode = 'both',
) => {
  if (mode === 'logical') return { primary: logical, secondary: undefined }
  if (mode === 'physical') return { primary: physical, secondary: undefined }
  return {
    primary: logical,
    secondary: physical && physical !== logical ? physical : undefined,
  }
}

export const sampleDocument = (): ErdDocument => {
  const emailDomain = defaultDomain({
    name: '이메일',
    type: 'varchar',
    length: '255',
    nn: true,
  })
  const idDomain = defaultDomain({
    name: '일련번호',
    type: 'int',
    length: undefined,
    nn: true,
  })

  const users = defaultTable({
    logicalName: '사용자',
    physicalName: 'users',
    color: '#3b82f6',
    position: { x: 80, y: 80 },
    columns: [
      applyDomain(pkColumn(), idDomain),
      applyDomain(
        defaultColumn({
          logicalName: '이메일',
          physicalName: 'email',
          unique: true,
        }),
        emailDomain,
      ),
      defaultColumn({
        logicalName: '이름',
        physicalName: 'name',
        type: 'varchar',
        length: '100',
        nn: true,
      }),
      defaultColumn({
        logicalName: '생성일',
        physicalName: 'created_at',
        type: 'timestamp',
        length: undefined,
        nn: true,
        defaultValue: 'CURRENT_TIMESTAMP',
      }),
    ],
  })

  const posts = defaultTable({
    logicalName: '게시글',
    physicalName: 'posts',
    color: '#10b981',
    position: { x: 420, y: 80 },
    columns: orderTableColumns([
      pkColumn(),
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
        nn: true,
      }),
      defaultColumn({
        logicalName: '작성자',
        physicalName: 'user_id',
        type: 'int',
        length: undefined,
        nn: true,
        fk: true,
      }),
    ]),
  })

  const comments = defaultTable({
    logicalName: '댓글',
    physicalName: 'comments',
    color: '#f59e0b',
    position: { x: 760, y: 80 },
    columns: orderTableColumns([
      pkColumn(),
      defaultColumn({
        logicalName: '내용',
        physicalName: 'body',
        type: 'text',
        length: undefined,
        nn: true,
      }),
      defaultColumn({
        logicalName: '게시글',
        physicalName: 'post_id',
        type: 'int',
        length: undefined,
        nn: true,
        fk: true,
      }),
      defaultColumn({
        logicalName: '작성자',
        physicalName: 'user_id',
        type: 'int',
        length: undefined,
        nn: true,
        fk: true,
      }),
    ]),
  })

  const userId = users.columns[0].id
  const postUserFk = posts.columns.find((c) => c.physicalName === 'user_id')!.id
  const postId = posts.columns[0].id
  const commentPostFk = comments.columns.find(
    (c) => c.physicalName === 'post_id',
  )!.id
  const commentUserFk = comments.columns.find(
    (c) => c.physicalName === 'user_id',
  )!.id

  return ensureDocumentIds({
    schemas: [],
    tables: [users, posts, comments],
    relations: [
      {
        id: createId('rel'),
        sourceTableId: users.id,
        targetTableId: posts.id,
        sourceColumnIds: [userId],
        targetColumnIds: [postUserFk],
        kind: 'non-identifying',
        sourceCardinality: '1',
        targetCardinality: 'N',
      },
      {
        id: createId('rel'),
        sourceTableId: posts.id,
        targetTableId: comments.id,
        sourceColumnIds: [postId],
        targetColumnIds: [commentPostFk],
        kind: 'identifying',
        sourceCardinality: '1',
        targetCardinality: 'N',
        onDelete: 'CASCADE',
      },
      {
        id: createId('rel'),
        sourceTableId: users.id,
        targetTableId: comments.id,
        sourceColumnIds: [userId],
        targetColumnIds: [commentUserFk],
        kind: 'non-identifying',
        sourceCardinality: '1',
        targetCardinality: 'N',
      },
    ],
    notes: [
      defaultNote({
        text: '샘플 블로그 스키마예요. 테이블 이름을 더블클릭해서 바꾸고, 관계선으로 연결해 보세요.',
        position: { x: 80, y: 360 },
        width: 280,
        height: 120,
      }),
    ],
    domains: [idDomain, emailDomain],
    settings: defaultViewSettings(),
  })
}
