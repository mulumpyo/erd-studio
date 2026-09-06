import * as Y from 'yjs'
import { yToErd } from '@erd-studio/yjs-erd'

export type PersistPrisma = {
  project: {
    // Prisma's Buffer typing differs across TS/Node; keep this seam narrow for tests.
    update: (args: {
      where: { id: string }
      data: { yjsState: Buffer; snapshot: object }
    }) => Promise<unknown>
  }
}

export type PersistLogger = {
  error: (...args: unknown[]) => void
}

const writeOnce = async (
  prisma: PersistPrisma,
  documentName: string,
  state: Uint8Array,
) => {
  const ydoc = new Y.Doc()
  try {
    Y.applyUpdate(ydoc, state)
    await prisma.project.update({
      where: { id: documentName },
      data: {
        yjsState: Buffer.from(state),
        snapshot: yToErd(ydoc) as object,
      },
    })
  } finally {
    ydoc.destroy()
  }
}

/**
 * Persist Yjs state with one retry. Failures are logged and rethrown so
 * Hocuspocus does not treat the store as successful.
 */
export const persistDocumentState = async (
  prisma: PersistPrisma,
  documentName: string,
  state: Uint8Array,
  log: PersistLogger = console,
): Promise<void> => {
  try {
    await writeOnce(prisma, documentName, state)
  } catch (error) {
    log.error('[collab] store failed', {
      projectId: documentName,
      error: error instanceof Error ? error.message : error,
    })
    try {
      await writeOnce(prisma, documentName, state)
    } catch (retryError) {
      log.error('[collab] store retry failed', {
        projectId: documentName,
        error: retryError instanceof Error ? retryError.message : retryError,
      })
      throw retryError
    }
  }
}
