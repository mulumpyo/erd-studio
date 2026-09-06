import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as Y from 'yjs'
import {
  applyCachedAuth,
  applyKick,
  buildAuthCapabilities,
  dropConnection,
  invalidateAuth,
  type AuthContext,
} from './auth-capabilities'
import { assertJwtNotDenied } from './deny-list'
import { persistDocumentState } from './persist-document'

const emptyUpdate = () => {
  const doc = new Y.Doc()
  try {
    return Y.encodeStateAsUpdate(doc)
  } finally {
    doc.destroy()
  }
}

test('applyCachedAuth uses connection cache without Prisma', () => {
  const connection = { readOnly: false }
  const context: AuthContext = {
    auth: buildAuthCapabilities({
      projectId: 'proj-1',
      token: 'tok',
      userId: 'user-1',
      canEdit: true,
    }),
  }
  const caps = applyCachedAuth(connection, context)
  assert.equal(caps.canEdit, true)
  assert.equal(connection.readOnly, false)

  context.auth = buildAuthCapabilities({
    projectId: 'proj-1',
    token: 'tok',
    userId: 'user-1',
    canEdit: false,
  })
  applyCachedAuth(connection, context)
  assert.equal(connection.readOnly, true)
})

test('applyCachedAuth rejects missing or invalidated auth', () => {
  const connection = { readOnly: false }
  assert.throws(() => applyCachedAuth(connection, {}), /forbidden/)
  assert.throws(
    () => applyCachedAuth(connection, { auth: null }),
    /forbidden/,
  )
})

test('kick invalidates auth cache and drops matching connections', () => {
  const closed: string[] = []
  const editor: AuthContext = {
    user: { id: 'user-editor' },
    auth: buildAuthCapabilities({
      projectId: 'proj-a',
      token: 'a',
      userId: 'user-editor',
      canEdit: true,
    }),
  }
  const viewer: AuthContext = {
    user: { id: 'user-viewer' },
    auth: buildAuthCapabilities({
      projectId: 'proj-a',
      token: 'b',
      userId: 'user-viewer',
      canEdit: false,
    }),
  }
  const otherProject: AuthContext = {
    user: { id: 'user-editor' },
    auth: buildAuthCapabilities({
      projectId: 'proj-b',
      token: 'c',
      userId: 'user-editor',
      canEdit: true,
    }),
  }

  const documents = new Map<string, unknown>([
    [
      'proj-a',
      {
        connections: new Map([
          [
            1,
            {
              readOnly: false,
              context: editor,
              close: () => closed.push('editor'),
            },
          ],
          [
            2,
            {
              readOnly: true,
              context: viewer,
              close: () => closed.push('viewer'),
            },
          ],
        ]),
      },
    ],
    [
      'proj-b',
      {
        connections: new Map([
          [
            3,
            {
              readOnly: false,
              context: otherProject,
              close: () => closed.push('other'),
            },
          ],
        ]),
      },
    ],
  ])

  const dropped = applyKick(documents, {
    projectId: 'proj-a',
    userId: 'user-editor',
  })
  assert.equal(dropped, 1)
  assert.deepEqual(closed, ['editor'])
  assert.equal(editor.auth, null)
  assert.ok(viewer.auth)
  assert.ok(otherProject.auth)
})

test('kick without userId clears all project connections', () => {
  const contexts: AuthContext[] = [
    {
      user: { id: 'a' },
      auth: buildAuthCapabilities({
        projectId: 'p',
        token: 't',
        userId: 'a',
        canEdit: true,
      }),
    },
    {
      user: { id: 'b' },
      auth: buildAuthCapabilities({
        projectId: 'p',
        token: 't',
        userId: 'b',
        canEdit: false,
      }),
    },
  ]
  const documents = new Map<string, unknown>([
    [
      'p',
      {
        connections: new Map(
          contexts.map((context, i) => [
            i,
            { readOnly: false, context, close: () => undefined },
          ]),
        ),
      },
    ],
  ])
  assert.equal(applyKick(documents, { projectId: 'p' }), 2)
  assert.equal(contexts[0].auth, null)
  assert.equal(contexts[1].auth, null)
})

test('dropConnection clears auth before close', () => {
  const context: AuthContext = {
    user: { id: 'u' },
    auth: buildAuthCapabilities({
      projectId: 'p',
      token: 't',
      userId: 'u',
      canEdit: true,
    }),
  }
  let closed = false
  dropConnection({
    readOnly: false,
    context,
    close: () => {
      closed = true
    },
  })
  assert.equal(context.auth, null)
  assert.equal(closed, true)
})

test('invalidateAuth nulls capabilities used by beforeHandleMessage', () => {
  const context: AuthContext = {
    auth: buildAuthCapabilities({
      projectId: 'p',
      token: 't',
      userId: 'u',
      canEdit: true,
    }),
  }
  invalidateAuth(context)
  assert.throws(
    () => applyCachedAuth({ readOnly: false }, context),
    /forbidden/,
  )
})

test('assertJwtNotDenied fails closed when Redis errors', async () => {
  await assert.rejects(
    () =>
      assertJwtNotDenied(
        {
          get: async () => {
            throw new Error('ECONNREFUSED')
          },
        },
        'jti-1',
      ),
    /unauthorized/,
  )
})

test('assertJwtNotDenied rejects listed jti and allows unknown', async () => {
  await assert.rejects(
    () =>
      assertJwtNotDenied(
        { get: async () => '1' },
        'denied-jti',
      ),
    /unauthorized/,
  )
  await assertJwtNotDenied({ get: async () => null }, 'ok-jti')
  await assertJwtNotDenied({ get: async () => null }, undefined)
})

test('persistDocumentState retries once then rethrows', async () => {
  let attempts = 0
  const logs: unknown[] = []
  const prisma = {
    project: {
      update: async () => {
        attempts += 1
        throw new Error('db down')
      },
    },
  }
  await assert.rejects(
    () =>
      persistDocumentState(prisma, 'proj-fail', emptyUpdate(), {
        error: (...args) => logs.push(args),
      }),
    /db down/,
  )
  assert.equal(attempts, 2)
  assert.equal(logs.length, 2)
  assert.match(String(logs[0]), /store failed/)
  assert.match(String(logs[1]), /store retry failed/)
})

test('persistDocumentState succeeds on retry', async () => {
  let attempts = 0
  const prisma = {
    project: {
      update: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('transient')
      },
    },
  }
  await persistDocumentState(prisma, 'proj-ok', emptyUpdate(), {
    error: () => undefined,
  })
  assert.equal(attempts, 2)
})
