import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const retryable = (err: NodeJS.ErrnoException) =>
  err.code === 'ECONNREFUSED' ||
  err.code === 'ECONNRESET' ||
  err.code === 'ETIMEDOUT' ||
  err.code === 'EPIPE' ||
  err.code === 'EAI_AGAIN'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

const isStream = (path: string) =>
  path.startsWith('/notify/stream') || path.startsWith('/chat/inbox/stream')

const forward = (
  dest: URL,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
) =>
  new Promise<'sent' | 'retry'>((resolve, reject) => {
    const headers = { ...req.headers, host: dest.host }
    for (const name of HOP_BY_HOP) delete headers[name]
    if (isStream(path)) delete headers['content-length']
    else headers['content-length'] = String(body.length)

    req.socket.setTimeout(0)
    const proxyReq = http.request(
      {
        protocol: dest.protocol,
        hostname: dest.hostname,
        port: dest.port,
        method: req.method,
        path,
        headers,
      },
      (proxyRes) => {
        const outHeaders = { ...proxyRes.headers }
        for (const name of HOP_BY_HOP) delete outHeaders[name]
        if (isStream(path)) {
          outHeaders['cache-control'] = 'no-cache, no-transform'
          outHeaders['x-accel-buffering'] = 'no'
          outHeaders.connection = 'keep-alive'
        }
        req.socket.setTimeout(0)
        proxyRes.socket?.setTimeout(0)
        res.writeHead(proxyRes.statusCode ?? 502, outHeaders)
        proxyRes.on('data', (chunk) => {
          res.write(chunk)
        })
        proxyRes.on('end', () => {
          if (!res.writableEnded) res.end()
          resolve('sent')
        })
        proxyRes.on('error', reject)
      },
    )
    proxyReq.setTimeout(0)
    proxyReq.on('error', (err: NodeJS.ErrnoException) => {
      if (retryable(err)) resolve('retry')
      else reject(err)
    })
    if (isStream(path)) proxyReq.end()
    else proxyReq.end(body)
  })

export const apiProxy = (target: string): Plugin => {
  const dest = new URL(target)
  return {
    name: 'api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          next()
          return
        }
        void (async () => {
          try {
            const path = req.url!.replace(/^\/api/, '') || '/'
            const body = isStream(path) ? Buffer.alloc(0) : await readBody(req)
            const deadline = Date.now() + 20_000
            while (true) {
              const result = await forward(dest, path, req, res, body)
              if (result === 'sent' || res.headersSent) return
              if (Date.now() >= deadline) break
              await sleep(250)
            }
            if (!res.headersSent) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  statusCode: 502,
                  message: 'API 서버에 연결하지 못했어요.',
                }),
              )
            }
          } catch (error) {
            next(error)
          }
        })()
      })
    },
  }
}
