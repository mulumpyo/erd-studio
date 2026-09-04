import { createRouter, createWebHistory } from 'vue-router'
import { safeInternalPath } from './lib/urls'
import { applyClientSeo } from './lib/seo'
import { isMarketingPath, loadAppFont } from './lib/load-app-font'
import { useAuthStore } from './stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('./pages/Landing.vue'),
      meta: { guest: true },
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('./pages/Legal.vue'),
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('./pages/Legal.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./pages/Login.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('./pages/Register.vue'),
      meta: { guest: true },
    },
    {
      path: '/check-email',
      name: 'check-email',
      component: () => import('./pages/CheckEmail.vue'),
      meta: { guest: true },
    },
    {
      path: '/verify/:token',
      name: 'verify-email',
      component: () => import('./pages/VerifyEmail.vue'),
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('./pages/ForgotPassword.vue'),
      meta: { guest: true },
    },
    {
      path: '/reset/:token',
      name: 'reset-password',
      component: () => import('./pages/ResetPassword.vue'),
      meta: { guest: true },
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('./pages/Account.vue'),
      meta: { auth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('./pages/Admin.vue'),
      meta: { auth: true, admin: true },
    },
    {
      path: '/app',
      name: 'dashboard',
      component: () => import('./pages/Dashboard.vue'),
      meta: { auth: true },
    },
    {
      path: '/app/teams',
      name: 'teams',
      component: () => import('./pages/Dashboard.vue'),
      meta: { auth: true },
    },
    {
      path: '/app/teams/:teamId',
      name: 'team',
      component: () => import('./pages/Dashboard.vue'),
      meta: { auth: true },
    },
    {
      path: '/app/:id',
      name: 'editor',
      component: () => import('./pages/Editor.vue'),
    },
    {
      path: '/invite/:token',
      name: 'invite',
      component: () => import('./pages/Invite.vue'),
    },
    {
      path: '/s/:token',
      name: 'share',
      component: () => import('./pages/ShareView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  if (typeof window === 'undefined') return true
  const auth = useAuthStore()
  if (isMarketingPath(to.path)) {
    if (!auth.hydrated) {
      void auth.fetchMe().then(() => {
        if (auth.user && to.meta.guest) void router.replace({ name: 'dashboard' })
      })
    }
  } else if (!auth.hydrated) await auth.fetchMe()
  if (to.meta.auth && !auth.user)
    return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.admin && !auth.user?.isAdmin) return { name: 'dashboard' }
  if (to.meta.guest && auth.user) {
    if (to.name === 'login' || to.name === 'register') {
      const redirect = safeInternalPath(to.query.redirect)
      if (redirect) return redirect
    }
    return { name: 'dashboard' }
  }
  return true
})

router.afterEach((to) => {
  applyClientSeo(to.path)
  if (!isMarketingPath(to.path)) loadAppFont()
})


