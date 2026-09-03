export const LANDING_TITLE = 'ERD Studio — 팀과 함께 그리는 ERD'
export const LANDING_DESCRIPTION =
  '브라우저에서 까마귀발 ERD를 그리고, SQL로 주고받고, 팀과 실시간으로 같이 수정하세요.'

const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export const applyClientSeo = (path: string) => {
  if (typeof document === 'undefined') return
  const landing = path === '/'
  document.title = landing ? LANDING_TITLE : 'ERD Studio'
  upsertMeta(
    'name',
    'robots',
    landing ? 'index,follow' : 'noindex,nofollow',
  )
  if (landing) {
    upsertMeta('name', 'description', LANDING_DESCRIPTION)
    upsertMeta('property', 'og:title', LANDING_TITLE)
    upsertMeta('property', 'og:description', LANDING_DESCRIPTION)
  }
}
