import { apiOrigin } from './lib/urls'



const API = apiOrigin()



export class ApiError extends Error {

  constructor(

    public status: number,

    message: string,

  ) {

    super(message)

  }

}



type RefreshFn = () => Promise<string | null>



let refreshAccess: RefreshFn | null = null

let refreshing: Promise<string | null> | null = null



export const bindRefresh = (fn: RefreshFn) => {

  refreshAccess = fn

}



const skipRefresh = (path: string) =>

  path.startsWith('/api/auth/login') ||

  path.startsWith('/api/auth/register') ||

  path.startsWith('/api/auth/refresh') ||
  path.startsWith('/api/auth/me') ||

  path.startsWith('/api/auth/logout') ||

  path.startsWith('/api/auth/forgot-password') ||

  path.startsWith('/api/auth/reset-password')



const request = async (path: string, init: RequestInit) => {

  const headers = new Headers(init.headers)

  if (!headers.has('Content-Type') && init.body)

    headers.set('Content-Type', 'application/json')

  return fetch(`${API}${path}`, { ...init, headers, credentials: 'include' })

}



const gatewayTimeoutMessage = (status: number) =>
  status === 504
    ? '서버 게이트웨이가 응답을 기다리다 끊었어요. 잠시 후 다시 시도하거나 요청을 짧게 나눠 주세요.'
    : '서버에 잠시 연결하지 못했어요. 배포 중이거나 업스트림이 느릴 수 있어요. 잠시 후 다시 시도해 주세요.'

const readError = async (res: Response) => {
  let message = res.statusText
  try {
    const body = await res.json()
    message = body.message || body.error || message
    if (Array.isArray(message)) message = message.join(', ')
  } catch {
    /* ignore — nginx/Cloudflare 504 often returns HTML */
  }
  if (
    (res.status === 502 || res.status === 504) &&
    (!message ||
      /gateway|timeout|bad gateway|html|nginx/i.test(String(message)))
  ) {
    message = gatewayTimeoutMessage(res.status)
  }
  throw new ApiError(res.status, String(message))
}



const runRefresh = () => {

  if (!refreshAccess) return Promise.resolve(null)

  if (!refreshing) {

    refreshing = refreshAccess().finally(() => {

      refreshing = null

    })

  }

  return refreshing

}



export const api = async <T>(

  path: string,

  init: RequestInit = {},

  _token?: string | null,

): Promise<T> => {

  let res = await request(path, init)

  if (res.status === 401 && !skipRefresh(path)) {

    const next = await runRefresh()

    if (next) res = await request(path, init)

  }

  if (!res.ok) await readError(res)

  if (res.status === 204) return undefined as T

  return res.json()

}

