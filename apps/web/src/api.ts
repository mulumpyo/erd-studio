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



const readError = async (res: Response) => {

  let message = res.statusText

  try {

    const body = await res.json()

    message = body.message || body.error || message

    if (Array.isArray(message)) message = message.join(', ')

  } catch {

    /* ignore */

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

