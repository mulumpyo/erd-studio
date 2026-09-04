import { SITE_NAME } from './site'

export const DEFAULT_SITE_URL = 'https://erd-studio.com'
export const LANDING_TITLE = `${SITE_NAME} — 팀과 함께 그리는 ERD`
export const LANDING_DESCRIPTION =
  '브라우저에서 까마귀발 ERD를 그리고, SQL로 주고받고, 팀과 실시간으로 같이 수정하세요. 지금은 베타예요.'

export const normalizeSiteUrl = (value?: string | null) =>
  (value || DEFAULT_SITE_URL).replace(/\/$/, '')

export const publicSiteUrl = () =>
  normalizeSiteUrl(import.meta.env.VITE_SITE_URL)

export const canonicalForPath = (site: string, path: string) => {
  if (path === '/') return `${site}/`
  return `${site}${path}`
}

const indexedPath = (path: string) =>
  path === '/' || path === '/terms' || path === '/privacy'

const pageTitle = (path: string) => {
  if (path === '/') return LANDING_TITLE
  if (path === '/terms') return `이용약관 — ${SITE_NAME}`
  if (path === '/privacy') return `개인정보처리방침 — ${SITE_NAME}`
  return SITE_NAME
}

const pageDescription = (path: string) => {
  if (path === '/terms') return `${SITE_NAME} 이용약관이에요.`
  if (path === '/privacy') return `${SITE_NAME} 개인정보처리방침이에요.`
  return LANDING_DESCRIPTION
}

export const landingJsonLd = (site: string) => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${site}/`,
    description: LANDING_DESCRIPTION,
    inLanguage: 'ko-KR',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description: LANDING_DESCRIPTION,
    url: `${site}/`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
  },
]

const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

const upsertLink = (rel: string, href: string) => {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export const applyClientSeo = (path: string) => {
  if (typeof document === 'undefined') return
  const indexed = indexedPath(path)
  const site = publicSiteUrl()
  const title = pageTitle(path)
  const description = pageDescription(path)
  const canonical = canonicalForPath(site, path)

  document.title = title
  upsertMeta('name', 'robots', indexed ? 'index,follow' : 'noindex,nofollow')
  upsertMeta('name', 'description', description)
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', canonical)
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)

  if (indexed) upsertLink('canonical', canonical)
  else document.head.querySelector('link[rel="canonical"]')?.remove()
}
