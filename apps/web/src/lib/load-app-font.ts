export const isMarketingPath = (path: string) =>
  path === '/' || path === '/terms' || path === '/privacy'

let started = false

export const loadAppFont = () => {
  if (started) return
  started = true
  void import('../styles-font.css')
}
