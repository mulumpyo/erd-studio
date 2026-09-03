import { emptyCanvasModel, fromModels, toCanvasModel } from './canvas-model'
import {
  emptyDatabaseModel,
  toDatabaseModel,
  type DatabaseModel,
} from './database-model'
import type { CanvasModel } from './canvas-model'
import { normalizeDocument } from './erd-file'
import type { ErdDocument } from './erd-types'

export const VERSION_SNAPSHOT_KIND = 'erd-studio-version' as const

export type VersionSnapshot = {
  kind: typeof VERSION_SNAPSHOT_KIND
  capturedAt: string
  databaseModel: DatabaseModel
  canvas: CanvasModel
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

export const isVersionSnapshot = (value: unknown): value is VersionSnapshot => {
  const raw = asRecord(value)
  if (!raw || raw.kind !== VERSION_SNAPSHOT_KIND) return false
  return Boolean(asRecord(raw.databaseModel) && asRecord(raw.canvas))
}

export const captureVersionSnapshot = (
  doc: ErdDocument,
  capturedAt = new Date().toISOString(),
): VersionSnapshot => {
  const normalized = normalizeDocument(doc)
  return {
    kind: VERSION_SNAPSHOT_KIND,
    capturedAt,
    databaseModel: clone(toDatabaseModel(normalized)),
    canvas: clone(toCanvasModel(normalized)),
  }
}

export const normalizeVersionSnapshot = (raw: unknown): VersionSnapshot => {
  if (isVersionSnapshot(raw)) {
    return {
      kind: VERSION_SNAPSHOT_KIND,
      capturedAt: String(raw.capturedAt || ''),
      databaseModel: {
        ...emptyDatabaseModel(),
        ...clone(raw.databaseModel),
      },
      canvas: {
        ...emptyCanvasModel(),
        ...clone(raw.canvas),
      },
    }
  }
  return captureVersionSnapshot(normalizeDocument(raw))
}

export const documentFromVersionSnapshot = (raw: unknown): ErdDocument => {
  const snapshot = normalizeVersionSnapshot(raw)
  return fromModels(snapshot.databaseModel, snapshot.canvas)
}

export const databaseModelFromVersionSnapshot = (
  raw: unknown,
): DatabaseModel => clone(normalizeVersionSnapshot(raw).databaseModel)

export const canvasFromVersionSnapshot = (raw: unknown): CanvasModel =>
  clone(normalizeVersionSnapshot(raw).canvas)
