import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const KEY = 'erd_theme'

const systemDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

const readMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return systemDark() ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

const mode = ref<ThemeMode>('light')

export const applyTheme = (next: ThemeMode) => {
  const dark = next === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export const initTheme = () => {
  mode.value = readMode()
  applyTheme(mode.value)
  try {
    localStorage.setItem(KEY, mode.value)
  } catch {
    /* ignore */
  }
}

export const useTheme = () => {
  const resolved = computed(() => mode.value)

  const setMode = (next: ThemeMode) => {
    mode.value = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
    applyTheme(next)
  }

  const cycle = () => {
    setMode(mode.value === 'light' ? 'dark' : 'light')
  }

  return { mode, resolved, setMode, cycle }
}
