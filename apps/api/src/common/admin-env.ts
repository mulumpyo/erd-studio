export const bootstrapAdminEmail = () =>
  (process.env.INITIAL_ADMIN_EMAIL ?? '').trim().toLowerCase()

export const isBootstrapAdmin = (email: string) => {
  const seed = bootstrapAdminEmail()
  return Boolean(seed) && email.toLowerCase() === seed
}
