import { createServer, type Plugin, type ResolvedConfig } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'

const SITE_DESCRIPTION =
  '브라우저에서 까마귀발 ERD를 그리고, SQL로 주고받고, 팀과 실시간으로 같이 수정하세요.'

export const prerenderLanding = (): Plugin => {
  let config: ResolvedConfig
  return {
    name: 'prerender-landing',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved
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
        const siteUrl = (
          config.env.VITE_SITE_URL ||
          process.env.VITE_SITE_URL ||
          process.env.WEB_ORIGIN ||
          ''
        ).replace(/\/$/, '')
        html = html.replace(
          '<div id="app"></div>',
          `<div id="app">${appHtml}</div>`,
        )
        if (siteUrl && !html.includes('rel="canonical"')) {
          html = html.replace(
            '</head>',
            `    <link rel="canonical" href="${siteUrl}/" />\n    <meta property="og:url" content="${siteUrl}/" />\n  </head>`,
          )
        }
        if (!html.includes('application/ld+json')) {
          const jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ERD Studio',
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Web',
            description: SITE_DESCRIPTION,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
            ...(siteUrl ? { url: `${siteUrl}/` } : {}),
          }
          html = html.replace(
            '</head>',
            `    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`,
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
