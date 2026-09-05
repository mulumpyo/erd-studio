import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, bindRefresh } from '../api'
import { isSameOriginCollab } from '../lib/urls'

export type User = { id: string; email: string; name: string; isAdmin?: boolean }

export type RegisterResult = {
  needsVerification: true
  email: string
  mailed: boolean
  verifyUrl?: string
}

type SessionPayload = {
  user: User | null
  expiresAt?: number
  nextPath?: string
}

const SESSION = 'session'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)
  const hydrated = ref(false)
  let refreshTimer = 0

  const clearTimer = () => {
    if (refreshTimer) window.clearTimeout(refreshTimer)
    refreshTimer = 0
  }

  const setSession = (nextUser: User, expiresAt?: number) => {
    token.value = SESSION
    user.value = nextUser
    scheduleRefresh(expiresAt)
  }

  const clearSession = () => {
    clearTimer()
    token.value = null
    user.value = null
    localStorage.removeItem('erd_token')
    localStorage.removeItem('erd_refresh')
  }

  const refreshSession = async () => {
    try {
      const res = await api<SessionPayload>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setSession(res.user, res.expiresAt)
      return SESSION
    } catch {
      clearSession()
      return null
    }
  }

  const scheduleRefresh = (expiresAt?: number) => {
    clearTimer()
    if (!user.value) return
    const wait = expiresAt
      ? Math.max(5_000, expiresAt - Date.now() - 30_000)
      : 10 * 60 * 1000
    refreshTimer = window.setTimeout(() => {
      void refreshSession()
    }, wait)
  }

  bindRefresh(refreshSession)

  const logout = async () => {
    try {
      await api('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    } catch {
      /* still clear locally */
    }
    clearSession()
  }

  const login = async (email: string, password: string) => {
    const res = await api<SessionPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setSession(res.user, res.expiresAt)
  }

  const register = async (
    name: string,
    email: string,
    password: string,
    nextPath?: string | null,
  ) => {
    return api<RegisterResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        nextPath: nextPath || undefined,
      }),
    })
  }

  const verifyEmail = async (verifyToken: string) => {
    const res = await api<SessionPayload>(
      '/api/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({ token: verifyToken }),
      },
    )
    setSession(res.user, res.expiresAt)
    return res.nextPath
  }

  const resendVerification = (email: string) =>
    api<{ ok: true }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })

  const forgotPassword = (email: string) =>
    api<{ ok: true; resetUrl?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })

  const resetPassword = (resetToken: string, password: string) =>
    api<{ ok: true }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password }),
    })

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await api<{ ok: true }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    clearSession()
  }

  const deleteAccount = async (password: string) => {
    await api<{ ok: true }>('/api/auth/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    clearSession()
  }

  const fetchMe = async () => {
    try {
      const res = await api<SessionPayload>('/api/auth/me')
      if (res.user) setSession(res.user, res.expiresAt)
      else clearSession()
    } catch {
      clearSession()
    } finally {
      hydrated.value = true
    }
  }

  const collabCredential = async () => {
    if (!user.value) return 'public-read'
    if (isSameOriginCollab()) return ''
    const res = await api<{ token: string }>('/api/auth/ws-token')
    return res.token
  }

  return {
    token,
    user,
    hydrated,
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    changePassword,
    deleteAccount,
    logout,
    fetchMe,
    setSession,
    collabCredential,
  }
})
