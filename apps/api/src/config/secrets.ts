const WEAK_SECRETS = new Set(['change-me-in-production', 'secret', 'changeme'])

export const isProduction = () => process.env.NODE_ENV === 'production'

export const requireJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret) {
    throw new Error(
      'JWT_SECRET is required. Copy .env.example to .env and set a long random value.',
    )
  }
  const weak = WEAK_SECRETS.has(secret) || secret.length < 16
  if (isProduction() && weak) {
    throw new Error(
      'JWT_SECRET is too weak for production. Use a random string of at least 16 characters.',
    )
  }
  if (weak) {
    console.warn(
      '[erd-studio] JWT_SECRET is weak. Set a long random value before deploying.',
    )
  }
  return secret
}

export const allowDevMagicLinks = () =>
  !isProduction() && process.env.ALLOW_DEV_VERIFY_URL === 'true'

export const enableApiDocs = () =>
  !isProduction() || process.env.ENABLE_API_DOCS === 'true'
