import { ref } from 'vue'

export type ToastKind = 'success' | 'error'

export type ToastItem = {
  id: number
  message: string
  kind: ToastKind
}

const items = ref<ToastItem[]>([])
let seq = 0
const timers = new Map<number, number>()

type ToastOptions = {
  ms?: number
  kind?: ToastKind
}

export const dismiss = (id?: number) => {
  if (id == null) {
    for (const timer of timers.values()) window.clearTimeout(timer)
    timers.clear()
    items.value = []
    return
  }
  const timer = timers.get(id)
  if (timer) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
  items.value = items.value.filter((item) => item.id !== id)
}

export const toast = (text: string, opts?: number | ToastOptions) => {
  const options = typeof opts === 'number' ? { ms: opts } : opts
  const nextKind = options?.kind ?? 'success'
  const ms = options?.ms ?? (nextKind === 'error' ? 4500 : 2200)
  const id = ++seq
  items.value = [...items.value, { id, message: text, kind: nextKind }].slice(
    -3,
  )
  const timer = window.setTimeout(() => dismiss(id), ms)
  timers.set(id, timer)
}

/** @deprecated use items; kept for any leftover single-toast reads */
const message = ref('')
const kind = ref<ToastKind>('success')
const visible = ref(false)

export const useToast = () => ({
  items,
  message,
  kind,
  visible,
  toast,
  dismiss,
})
