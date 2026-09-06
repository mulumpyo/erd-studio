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

/** `페이지 — ERD Studio` 형식. 랜딩처럼 이미 브랜드가 있으면 그대로 둡니다. */
export const formatAppTitle = (page?: string | null) => {
  const part = (page || '').trim()
  if (!part) return SITE_NAME
  if (part === LANDING_TITLE || part === SITE_NAME) return part
  if (part.endsWith(` — ${SITE_NAME}`) || part.endsWith(` - ${SITE_NAME}`))
    return part
  return `${part} — ${SITE_NAME}`
}

export const setDocumentTitle = (page?: string | null, unread = 0) => {
  if (typeof document === 'undefined') return
  const base = formatAppTitle(page)
  document.title = unread > 0 ? `(${unread}) ${base}` : base
}

const pageTitle = (path: string) => {
  if (path === '/') return LANDING_TITLE
  if (path === '/terms') return formatAppTitle('이용약관')
  if (path === '/privacy') return formatAppTitle('개인정보처리방침')
  if (path === '/login') return formatAppTitle('로그인')
  if (path === '/register') return formatAppTitle('회원가입')
  if (path === '/check-email') return formatAppTitle('이메일 확인')
  if (path.startsWith('/verify/')) return formatAppTitle('이메일 인증')
  if (path === '/forgot-password') return formatAppTitle('비밀번호 찾기')
  if (path.startsWith('/reset/')) return formatAppTitle('비밀번호 재설정')
  if (path === '/account') return formatAppTitle('계정')
  if (path === '/admin') return formatAppTitle('관리자')
  if (path === '/app') return formatAppTitle('프로젝트')
  if (path === '/app/teams') return formatAppTitle('팀')
  if (path.startsWith('/app/teams/')) return formatAppTitle('팀')
  if (path.startsWith('/invite/')) return formatAppTitle('초대')
  if (path.startsWith('/s/')) return formatAppTitle('공유')
  if (path.startsWith('/app/')) return formatAppTitle('다이어그램')
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
