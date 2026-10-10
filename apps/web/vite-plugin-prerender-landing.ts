import { createServer, type Plugin, type ResolvedConfig } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_SITE_URL,
  landingJsonLd,
  normalizeSiteUrl,
} from './src/lib/seo'

/**
 * 프리렌더된 공개 페이지에서 앱 번들을 언제 불러올지 정해요.
 * 첫 렌더(LCP)를 막지 않게 load 뒤 브라우저가 한가할 때 부팅하고,
 * 그 전에 사용자가 누르거나 키를 치면 바로 부팅해요.
 * 같은 오리진 다른 경로 링크 클릭은 일반 페이지 이동에 맡겨요.
 */
export const landingBootScript = (entrySrc: string) => `
const src = ${JSON.stringify(entrySrc)}
const isPublic = (p) => p === '/' || p === '/terms' || p === '/privacy'
if (location.pathname === '/') {
  fetch('/api/auth/me', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.user) location.replace('/app') })
    .catch(() => {})
}
if (isPublic(location.pathname)) {
  const boot = () => {
    if (window.__erdBoot) return
    window.__erdBoot = 1
    import(src)
  }
  const onInput = (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href]')
    if (a) {
      try {
        const u = new URL(a.href, location.href)
        if (u.origin === location.origin && u.pathname !== location.pathname && a.target !== '_blank') return
      } catch {}
    }
    boot()
  }
  addEventListener('pointerdown', onInput, { once: true, capture: true })
  addEventListener('keydown', onInput, { once: true, capture: true })
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200))
  const scheduleIdle = () => idle(boot, { timeout: 2000 })
  if (document.readyState === 'complete') scheduleIdle()
  else addEventListener('load', scheduleIdle, { once: true })
} else {
  import(src)
}
`.trim()

export const prerenderLanding = (): Plugin => {
  let config: ResolvedConfig
  /** 랜딩 라우트 청크가 쓰는 CSS 파일이에요. 부팅 전에도 스타일이 맞게 인라인해요. */
  let landingCss: string[] = []
  return {
    name: 'prerender-landing',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved
    },
    generateBundle(_, bundle) {
      const chunk = Object.values(bundle).find(
        (c) =>
          c.type === 'chunk' &&
          c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/pages/Landing.vue'),
      )
      landingCss =
        chunk?.type === 'chunk' ? [...(chunk.viteMetadata?.importedCss ?? [])] : []
    },
    async closeBundle() {
      if (config.build.ssr) return
      const server = await createServer({
        configFile: path.join(config.root, 'vite.config.ts'),
        root: config.root,
        mode: config.mode,
        appType: 'custom',
        server: { middlewareMode: true, hmr: false },
      })
      try {
        const mod = await server.ssrLoadModule('/src/ssr/render-landing.ts')
        const appHtml = await mod.renderLanding()
        const indexPath = path.resolve(config.root, config.build.outDir, 'index.html')
        let html = await fs.readFile(indexPath, 'utf8')
        if (!html.includes('<div id="app"></div>')) {
          config.logger.warn('prerender-landing: #app placeholder missing, skipped')
          return
        }
        const siteUrl = normalizeSiteUrl(
          config.env.VITE_SITE_URL ||
            process.env.VITE_SITE_URL ||
            DEFAULT_SITE_URL,
        )
        html = html.replace(
          '<div id="app"></div>',
          `<div id="app">${appHtml}</div>`,
        )
        const stylesheet =
          /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/
        const cssLink = html.match(stylesheet)
        if (cssLink) {
          const cssPath = path.resolve(
            config.root,
            config.build.outDir,
            cssLink[1].replace(/^\//, ''),
          )
          const css = await fs.readFile(cssPath, 'utf8')
          html = html.replace(cssLink[0], `<style>${css}</style>`)
        }
        if (landingCss.length) {
          const routeCss = await Promise.all(
            landingCss.map((file) =>
              fs.readFile(path.resolve(config.root, config.build.outDir, file), 'utf8'),
            ),
          )
          html = html.replace(
            '</head>',
            `    <style>${routeCss.join('\n')}</style>\n  </head>`,
          )
        } else {
          config.logger.warn('prerender-landing: Landing route CSS not found')
        }
        if (!html.includes('rel="canonical"')) {
          html = html.replace(
            '</head>',
            `    <link rel="canonical" href="${siteUrl}/" />\n    <meta property="og:url" content="${siteUrl}/" />\n  </head>`,
          )
        }
        if (!html.includes('application/ld+json')) {
          html = html.replace(
            '</head>',
            `    <script type="application/ld+json">${JSON.stringify(landingJsonLd(siteUrl))}</script>\n  </head>`,
          )
        }
        html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')
        const moduleScript =
          /<script type="module" crossorigin src="([^"]+)"><\/script>/
        const entry = html.match(moduleScript)
        if (entry) {
          html = html.replace(
            entry[0],
            `<script type="module">${landingBootScript(entry[1])}</script>`,
          )
        }
        await fs.writeFile(indexPath, html)
        config.logger.info('prerendered landing HTML for SEO')
      } finally {
        await server.close()
      }
    },
  }
}
