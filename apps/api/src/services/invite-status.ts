export const inviteStatus = (invite: {
  acceptedAt: Date | null
  declinedAt?: Date | null
  expiresAt: Date
}) => {
  if (invite.acceptedAt) return 'accepted' as const
  if (invite.declinedAt) return 'declined' as const
  if (invite.expiresAt <= new Date()) return 'expired' as const
  return 'pending' as const
}
