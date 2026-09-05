import { createServer, type Plugin, type ResolvedConfig } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_SITE_URL,
  landingJsonLd,
  normalizeSiteUrl,
} from './src/lib/seo'

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
            `<script type="module">const s=${JSON.stringify(entry[1])};const m=p=>p==='/'||p==='/terms'||p==='/privacy';if(location.pathname==='/'){const goApp=()=>location.replace('/app');fetch('/api/auth/me',{credentials:'include'}).then(r=>{if(r.ok){goApp();return}if(r.status!==401)return;return fetch('/api/auth/refresh',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'}).then(x=>{if(x.ok)goApp()})}).catch(()=>{})}if(m(location.pathname)){const go=e=>{const a=e.target&&e.target.closest&&e.target.closest('a[href]');if(a){try{const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname!==location.pathname&&a.target!=='_blank')return}catch{}}if(!window.__erdBoot){window.__erdBoot=1;import(s)}};addEventListener('pointerdown',go,{once:true,capture:true});addEventListener('keydown',go,{once:true,capture:true})}else import(s)</script>`,
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
