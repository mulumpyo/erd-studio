import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canDeleteProject,
  canEditProject,
  canManageMembers,
  canViewProject,
  isProjectParticipant,
  isSameTenant,
  type ProjectAccess,
} from './access'

const teamA = (): ProjectAccess => ({
  ownerId: 'owner-a',
  teamId: 'team-a',
  isPublic: false,
  members: [{ userId: 'guest', role: 'editor' }],
  team: {
    ownerId: 'owner-a',
    members: [
      { userId: 'owner-a', role: 'owner' },
      { userId: 'editor-a', role: 'editor' },
      { userId: 'viewer-a', role: 'viewer' },
    ],
  },
})

const teamB = (): ProjectAccess => ({
  ownerId: 'owner-b',
  teamId: 'team-b',
  isPublic: false,
  members: [],
  team: {
    ownerId: 'owner-b',
    members: [
      { userId: 'owner-b', role: 'owner' },
      { userId: 'editor-b', role: 'editor' },
    ],
  },
})

test('team members stay inside their tenant', () => {
  const project = teamA()
  assert.equal(isSameTenant({ id: 'editor-a' }, project), true)
  assert.equal(canViewProject({ id: 'editor-a' }, project), true)
  assert.equal(canEditProject({ id: 'editor-a' }, project), true)
  assert.equal(canEditProject({ id: 'viewer-a' }, project), false)
})

test('another team cannot access a project even with the id', () => {
  const project = teamA()
  for (const id of ['editor-b', 'owner-b', 'viewer-b']) {
    assert.equal(isSameTenant({ id }, project), false)
    assert.equal(canViewProject({ id }, project), false)
    assert.equal(canEditProject({ id }, project), false)
    assert.equal(canDeleteProject({ id }, project), false)
    assert.equal(canManageMembers({ id }, project), false)
  }
})

test('project membership without team membership does not cross tenants', () => {
  const project = teamA()
  assert.equal(isSameTenant({ id: 'guest' }, project), false)
  assert.equal(canViewProject({ id: 'guest' }, project), false)
})

test('public projects are visible without tenant membership', () => {
  const project = { ...teamA(), isPublic: true }
  assert.equal(canViewProject({ id: 'stranger' }, project), true)
  assert.equal(isSameTenant({ id: 'stranger' }, project), false)
  assert.equal(canEditProject({ id: 'stranger' }, project), false)
  assert.equal(canViewProject(null, project), true)
  assert.equal(isProjectParticipant({ id: 'stranger' }, project), false)
  assert.equal(canManageMembers({ id: 'stranger' }, project), false)
})

test('anonymous cannot view or edit a private project', () => {
  const project = teamA()
  assert.equal(canViewProject(null, project), false)
  assert.equal(isProjectParticipant(null, project), false)
})

test('project role overlays team role inside the same tenant', () => {
  const project: ProjectAccess = {
    ...teamA(),
    members: [{ userId: 'editor-a', role: 'viewer' }],
  }
  assert.equal(canViewProject({ id: 'editor-a' }, project), true)
  assert.equal(canEditProject({ id: 'editor-a' }, project), false)
  assert.equal(canManageMembers({ id: 'editor-a' }, project), false)
})

test('viewer cannot edit, manage members, or delete', () => {
  const project = teamA()
  const viewer = { id: 'viewer-a' }
  assert.equal(canEditProject(viewer, project), false)
  assert.equal(canManageMembers(viewer, project), false)
  assert.equal(canDeleteProject(viewer, project), false)
})

test('editor cannot change ownership-level controls', () => {
  const project = teamA()
  const editor = { id: 'editor-a' }
  assert.equal(canEditProject(editor, project), true)
  assert.equal(canManageMembers(editor, project), false)
  assert.equal(canDeleteProject(editor, project), false)
})

test('only owner or team owner can delete', () => {
  const project = teamA()
  assert.equal(canDeleteProject({ id: 'owner-a' }, project), true)
  assert.equal(canDeleteProject({ id: 'editor-a' }, project), false)
  const otherTeamOwner: ProjectAccess = {
    ...teamA(),
    team: { ownerId: 'owner-a', members: teamA().team!.members },
  }
  assert.equal(canDeleteProject({ id: 'owner-a' }, otherTeamOwner), true)
})

test('team B editor is denied on team A public write and private read', () => {
  const privateA = teamA()
  const publicA = { ...teamA(), isPublic: true }
  const editorB = { id: 'editor-b' }
  assert.equal(canViewProject(editorB, privateA), false)
  assert.equal(canViewProject(editorB, publicA), true)
  assert.equal(canEditProject(editorB, publicA), false)
  assert.equal(isSameTenant(editorB, teamB()), true)
})
