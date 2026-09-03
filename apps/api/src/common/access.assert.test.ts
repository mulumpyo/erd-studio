import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import {
  assertEdit,
  assertManageMembers,
  assertParticipant,
  assertView,
} from './access'
import type { ProjectAccess } from '@erd-studio/shared'

const privateProject = (): ProjectAccess => ({
  ownerId: 'owner-a',
  teamId: 'team-a',
  isPublic: false,
  members: [],
  team: {
    ownerId: 'owner-a',
    members: [
      { userId: 'owner-a', role: 'owner' },
      { userId: 'editor-a', role: 'editor' },
      { userId: 'viewer-a', role: 'viewer' },
    ],
  },
})

test('cross-tenant GET looks like not found', () => {
  const project = privateProject()
  assert.throws(
    () => assertView({ id: 'editor-b', email: 'b@x.com', name: 'B' }, project),
    NotFoundException,
  )
  assert.throws(() => assertView(null, project), NotFoundException)
})

test('anonymous public view is allowed and write is denied', () => {
  const project = { ...privateProject(), isPublic: true }
  assertView(null, project)
  assert.throws(
    () => assertParticipant(null, project),
    /로그인이 필요해요/,
  )
  assert.throws(
    () =>
      assertEdit({ id: 'stranger', email: 's@x.com', name: 'S' }, project),
    ForbiddenException,
  )
})

test('viewer cannot edit via API helpers', () => {
  const project = privateProject()
  const viewer = { id: 'viewer-a', email: 'v@x.com', name: 'V' }
  assertView(viewer, project)
  assert.throws(() => assertEdit(viewer, project), ForbiddenException)
  assert.throws(() => assertManageMembers(viewer, project), ForbiddenException)
})

test('editor cannot change members or ownership-level settings', () => {
  const project = privateProject()
  const editor = { id: 'editor-a', email: 'e@x.com', name: 'E' }
  assertView(editor, project)
  assertEdit(editor, project)
  assert.throws(() => assertManageMembers(editor, project), ForbiddenException)
})

test('public member list is denied to non-participants', () => {
  const project = { ...privateProject(), isPublic: true }
  const stranger = { id: 'stranger', email: 's@x.com', name: 'S' }
  assertView(stranger, project)
  assert.throws(() => assertParticipant(stranger, project), ForbiddenException)
})
