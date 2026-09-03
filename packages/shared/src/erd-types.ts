import type { ReferentialAction } from './referential'
import type { ErdViewSettings } from './view-settings'

export type Cardinality = '1' | 'N'
export type RelationKind = 'identifying' | 'non-identifying'
export type UserRole = 'owner' | 'editor' | 'viewer'
export type SqlDialect = 'mysql' | 'postgres' | 'mssql' | 'oracle'

export interface ErdSchema {
  id: string
  name: string
}

export interface ErdColumn {
  id: string
  logicalName: string
  physicalName: string
  type: string
  length?: string
  pk: boolean
  fk: boolean
  nn: boolean
  unique: boolean
  autoIncrement: boolean
  defaultValue?: string
  comment?: string
  domainId?: string
}

export interface ErdTable {
  id: string
  schemaId: string
  logicalName: string
  physicalName: string
  comment?: string
  color: string
  position: { x: number; y: number }
  columns: ErdColumn[]
}

export interface ErdRelation {
  id: string
  name?: string
  sourceTableId: string
  targetTableId: string
  sourceColumnIds: string[]
  targetColumnIds: string[]
  kind: RelationKind
  sourceCardinality: Cardinality
  targetCardinality: Cardinality
  onDelete?: ReferentialAction
  onUpdate?: ReferentialAction
}

export interface ErdNote {
  id: string
  text: string
  color: string
  position: { x: number; y: number }
  width: number
  height: number
}

export interface ErdDomain {
  id: string
  name: string
  type: string
  length?: string
  nn: boolean
}

export interface ErdDocument {
  schemas: ErdSchema[]
  tables: ErdTable[]
  relations: ErdRelation[]
  notes: ErdNote[]
  domains: ErdDomain[]
  settings: ErdViewSettings
}
