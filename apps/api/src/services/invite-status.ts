export const inviteStatus = (invite: {
  acceptedAt: Date | null
  expiresAt: Date
}) => {
  if (invite.acceptedAt) return 'accepted' as const
  if (invite.expiresAt <= new Date()) return 'expired' as const
  return 'pending' as const
}
