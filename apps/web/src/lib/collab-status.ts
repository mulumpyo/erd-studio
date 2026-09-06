export type CollabConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'auth_failed'

export type CollabSyncStatus = 'local' | 'synced' | 'syncing' | 'offline'

export const connectionStatusLabel = (status: CollabConnectionStatus) => {
  switch (status) {
    case 'connected':
      return '연결됨'
    case 'connecting':
      return '연결 중'
    case 'auth_failed':
      return '인증 실패'
    case 'disconnected':
      return '연결 끊김'
    default:
      return '로컬'
  }
}

export const syncStatusLabel = (status: CollabSyncStatus) => {
  switch (status) {
    case 'synced':
      return '동기화됨'
    case 'syncing':
      return '동기화 중'
    case 'offline':
      return '동기화 안 됨'
    default:
      return '로컬만'
  }
}

export const isConnectionUnhealthy = (status: CollabConnectionStatus) =>
  status === 'disconnected' || status === 'auth_failed'
