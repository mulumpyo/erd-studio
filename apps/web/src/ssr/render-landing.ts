import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import Landing from '@/pages/Landing.vue'

export const renderLanding = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Landing }],
  })
  const app = createSSRApp({ template: '<router-view />' })
  app.use(router)
  await router.push('/')
  await router.isReady()
  return renderToString(app)
}
