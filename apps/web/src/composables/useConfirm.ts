import { computed, ref } from 'vue'

export type ConfirmRequest = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  matchValue?: string
  matchHint?: string
  /** 고를 게 없는 알림. 취소 버튼을 숨기고 확인 버튼만 보여줍니다. */
  noticeOnly?: boolean
}

export type NoticeRequest = Pick<
  ConfirmRequest,
  'title' | 'description' | 'confirmLabel'
>

const open = ref(false)
const request = ref<ConfirmRequest | null>(null)
const typed = ref('')
let resolver: ((ok: boolean) => void) | null = null

const expectedMatch = computed(
  () => request.value?.matchValue?.trim() ?? '',
)
const matchRequired = computed(() => expectedMatch.value.length > 0)
const matchOk = computed(() => {
  if (!matchRequired.value) return true
  return typed.value.trim() === expectedMatch.value
})
const typedMismatch = computed(
  () => matchRequired.value && typed.value.length > 0 && !matchOk.value,
)
const noticeOnly = computed(() => request.value?.noticeOnly ?? false)

const close = (ok: boolean) => {
  open.value = false
  const resolve = resolver
  resolver = null
  request.value = null
  typed.value = ''
  resolve?.(ok)
}

export const confirm = (opts: ConfirmRequest) => {
  if (resolver) {
    const resolve = resolver
    resolver = null
    resolve(false)
  }
  request.value = opts
  typed.value = ''
  open.value = true
  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

export const notice = (opts: NoticeRequest) =>
  confirm({ ...opts, noticeOnly: true })

export const useConfirm = () => ({
  open,
  request,
  typed,
  matchRequired,
  matchOk,
  typedMismatch,
  noticeOnly,
  close,
})
