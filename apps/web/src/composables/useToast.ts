import { ref } from 'vue'

export type ToastKind = 'success' | 'error'

const message = ref('')
const kind = ref<ToastKind>('success')
const visible = ref(false)
let timer = 0

type ToastOptions = {
  ms?: number
  kind?: ToastKind
}

export const toast = (text: string, opts?: number | ToastOptions) => {
  const ms = typeof opts === 'number' ? opts : (opts?.ms ?? 2200)
  kind.value = typeof opts === 'number' ? 'success' : (opts?.kind ?? 'success')
  message.value = text
  visible.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    visible.value = false
  }, ms)
}

export const useToast = () => ({ message, kind, visible, toast })
