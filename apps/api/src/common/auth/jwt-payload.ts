export type JwtPayload = {
  sub: string
  email: string
  typ?: string
  jti?: string
  iat?: number
  exp?: number
}
