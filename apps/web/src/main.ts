import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { initTheme } from './composables/useTheme'
import { isMarketingPath, loadAppFont } from './lib/load-app-font'
import './styles.css'

initTheme()
if (!isMarketingPath(window.location.pathname)) loadAppFont()
createApp(App).use(createPinia()).use(router).mount('#app')
