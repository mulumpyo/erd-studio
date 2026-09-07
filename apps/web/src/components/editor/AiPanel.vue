<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { ErdDocument } from '@erd-studio/shared'
import { api } from '@/api'
import { errorMessage } from '@/lib/format'
import { toAiRequestDocument } from '@/lib/ai-document'
import {
  aiSettingsStorageKey,
  loadAiSettings,
  persistAiSettings,
} from '@/lib/ai-settings-storage'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import PasswordInput from '@/components/ui/input/PasswordInput.vue'
import Select from '@/components/ui/select/Select.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { ChevronDown, Ellipsis, RefreshCw, SendHorizontal } from 'lucide-vue-next'

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'

type AiProvider = 'openai' | 'gemini' | 'other'

type AiSettings = {
  provider: AiProvider
  apiKey: string
  model: string
  baseUrl?: string
}

type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  applied?: boolean
}

const KEY_PREFIX: Partial<Record<AiProvider, string>> = {
  openai: 'sk-',
}

const PROVIDERS: Record<
  AiProvider,
  {
    label: string
    keyHint: string
    defaultModel: string
    activeClass: string
    idleClass: string
  }
> = {
  openai: {
    label: 'ChatGPT',
    keyHint: 'proj-... 또는 ...',
    defaultModel: 'gpt-4o-mini',
    activeClass:
      'bg-black text-white shadow-[0_6px_16px_rgb(0_0_0_/_0.22)] dark:bg-white dark:text-black dark:shadow-[0_6px_16px_rgb(255_255_255_/_0.12)]',
    idleClass:
      'bg-black/8 text-black hover:bg-black/12 dark:bg-white/10 dark:text-white dark:hover:bg-white/16',
  },
  gemini: {
    label: 'Gemini',
    keyHint: 'AQ.... 또는 AIza...',
    defaultModel: 'gemini-2.0-flash',
    activeClass:
      'bg-gradient-to-r from-[#4a8bf5] via-[#8b6cff] to-[#d96570] text-white shadow-[0_6px_16px_rgb(75_108_255_/_0.28)]',
    idleClass:
      'bg-[#8b6cff]/12 text-[#5b4fcf] hover:bg-[#8b6cff]/18 dark:bg-[#8b6cff]/20 dark:text-[#c4b5ff] dark:hover:bg-[#8b6cff]/28',
  },
  other: {
    label: '기타',
    keyHint: 'API 키',
    defaultModel: '',
    activeClass: 'bg-zinc-700 text-white shadow-[0_6px_16px_rgb(39_39_42_/_0.28)] dark:bg-zinc-200 dark:text-zinc-900',
    idleClass:
      'bg-zinc-500/12 text-zinc-700 hover:bg-zinc-500/18 dark:bg-zinc-400/15 dark:text-zinc-200 dark:hover:bg-zinc-400/25',
  },
}

const props = defineProps<{
  document: ErdDocument
  readOnly?: boolean
  initialPrompt?: string
}>()

const emit = defineEmits<{
  apply: [doc: ErdDocument]
}>()

const auth = useAuthStore()
const draft = ref(props.initialPrompt?.trim() || '')
const provider = ref<AiProvider>('openai')
const apiKeyBody = ref('')
const baseUrl = ref('')
const model = ref('')
const busy = ref(false)
const modelsLoading = ref(false)
const modelsError = ref('')
const saved = ref(false)
const settingsOpen = ref(true)
const messages = ref<ChatMsg[]>([])
const scroller = ref<HTMLElement | null>(null)
const composer = ref<HTMLElement | null>(null)
const coarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches
const modelOptions = ref<Array<{ value: string; label: string }>>([])
const defaultModels = ref({
  openai: PROVIDERS.openai.defaultModel,
  gemini: PROVIDERS.gemini.defaultModel,
  other: '',
})
let modelsRequest = 0
let modelsTimer: ReturnType<typeof setTimeout> | null = null
let msgSeq = 0

const examples = [
  '블로그: 사용자, 글, 댓글',
  '주문 테이블에 배송지 컬럼 추가',
  '사용자와 주문을 1:N으로 연결',
]

const storageKey = () => aiSettingsStorageKey(auth.user?.id)

const activeProvider = computed(() => PROVIDERS[provider.value])
const keyPrefix = computed(() => KEY_PREFIX[provider.value] || '')
const isOther = computed(() => provider.value === 'other')

const stripKeyPrefix = (p: AiProvider, raw: string) => {
  const compact = raw.replace(/\s+/g, '')
  if (!compact) return ''
  const prefix = KEY_PREFIX[p]
  if (!prefix) return compact
  if (compact.toLowerCase().startsWith(prefix.toLowerCase())) {
    return compact.slice(prefix.length)
  }
  return compact
}

const fullApiKey = computed(() => {
  const body = apiKeyBody.value.replace(/\s+/g, '')
  return `${keyPrefix.value}${body}`
})

const baseUrlReady = computed(() => {
  if (!isOther.value) return true
  const raw = baseUrl.value.trim()
  if (!raw) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:'
  } catch {
    return false
  }
})

const keyReady = computed(
  () => apiKeyBody.value.replace(/\s+/g, '').length >= 8 && baseUrlReady.value,
)

const canSend = computed(
  () =>
    !props.readOnly &&
    !busy.value &&
    keyReady.value &&
    Boolean(model.value.trim()) &&
    draft.value.trim().length >= 1,
)

const pickModel = (preferred: string, ids: string[], fallback: string) => {
  if (preferred && ids.includes(preferred)) return preferred
  if (fallback && ids.includes(fallback)) return fallback
  return ids[0] || fallback || ''
}

const clearModelList = () => {
  modelOptions.value = []
  modelsError.value = ''
}

const scrollToEnd = async () => {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

const revealComposer = async () => {
  await nextTick()
  composer.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  // Re-publish after keyboard animation on mobile.
  window.setTimeout(() => {
    composer.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, 300)
}

const loadModels = async (opts?: { force?: boolean }) => {
  if (!keyReady.value || props.readOnly) {
    clearModelList()
    return
  }
  const req = ++modelsRequest
  modelsLoading.value = true
  modelsError.value = ''
  try {
    const body: Record<string, string> = {
      provider: provider.value,
      apiKey: fullApiKey.value,
    }
    if (provider.value === 'other') body.baseUrl = baseUrl.value.trim()
    const result = await api<{
      models: Array<{ id: string; label: string }>
      defaultModel: string
    }>('/api/ai/models', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (req !== modelsRequest) return
    const options = result.models.map((item) => ({
      value: item.id,
      label: item.label,
    }))
    modelOptions.value = options
    const ids = options.map((item) => item.value)
    model.value = pickModel(
      model.value.trim(),
      ids,
      result.defaultModel || defaultModels.value[provider.value],
    )
    if (!model.value && options[0]) settingsOpen.value = false
  } catch (e) {
    if (req !== modelsRequest) return
    clearModelList()
    const fallback = defaultModels.value[provider.value] || model.value.trim()
    if (fallback) {
      model.value = fallback
      modelOptions.value = [{ value: fallback, label: fallback }]
    }
    modelsError.value = errorMessage(e, '모델 목록을 불러오지 못했어요')
    if (opts?.force) toast(modelsError.value, { kind: 'error' })
  } finally {
    if (req === modelsRequest) modelsLoading.value = false
  }
}

const scheduleLoadModels = () => {
  if (modelsTimer) clearTimeout(modelsTimer)
  modelsTimer = setTimeout(() => {
    modelsTimer = null
    void loadModels()
  }, 450)
}

const loadSettings = () => {
  const key = storageKey()
  provider.value = 'openai'
  apiKeyBody.value = ''
  baseUrl.value = ''
  model.value = ''
  saved.value = false
  settingsOpen.value = true
  if (!key) return
  try {
    const parsed = loadAiSettings(key, sessionStorage, localStorage)
    if (!parsed) return
    if (
      parsed.provider === 'openai' ||
      parsed.provider === 'gemini' ||
      parsed.provider === 'other'
    ) {
      provider.value = parsed.provider
    }
    if (typeof parsed.baseUrl === 'string') baseUrl.value = parsed.baseUrl
    const storedKey =
      typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : ''
    apiKeyBody.value = stripKeyPrefix(provider.value, storedKey)
    model.value = typeof parsed.model === 'string' ? parsed.model : ''
    saved.value = Boolean(apiKeyBody.value || model.value || baseUrl.value)
    if (apiKeyBody.value && model.value && (!isOther.value || baseUrl.value)) {
      settingsOpen.value = false
    }
  } catch {
    /* ignore */
  }
}

const persistSettings = () => {
  const key = storageKey()
  if (!key) return
  const body = apiKeyBody.value.replace(/\s+/g, '')
  apiKeyBody.value = body
  const payload: AiSettings = {
    provider: provider.value,
    apiKey: body ? fullApiKey.value : '',
    model: model.value.trim(),
    baseUrl: provider.value === 'other' ? baseUrl.value.trim() : undefined,
  }
  try {
    saved.value = persistAiSettings(key, payload, sessionStorage, localStorage)
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  loadSettings()
  try {
    const status = await api<{
      defaultModels?: { openai?: string; gemini?: string }
    }>('/api/ai/status')
    if (status.defaultModels?.openai) {
      defaultModels.value.openai = status.defaultModels.openai
    }
    if (status.defaultModels?.gemini) {
      defaultModels.value.gemini = status.defaultModels.gemini
    }
  } catch {
    /* keep defaults */
  }
  if (keyReady.value) void loadModels()
  void scrollToEnd()
})

watch(
  () => auth.user?.id,
  () => {
    loadSettings()
    if (keyReady.value) scheduleLoadModels()
    else clearModelList()
  },
)

watch(keyReady, (ready) => {
  if (ready) scheduleLoadModels()
  else {
    if (modelsTimer) clearTimeout(modelsTimer)
    clearModelList()
    if (!model.value.trim()) {
      model.value = defaultModels.value[provider.value]
    }
  }
})

watch(apiKeyBody, (value) => {
  const prefix = KEY_PREFIX[provider.value]
  if (!prefix) return
  const trimmed = value.trimStart()
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    apiKeyBody.value = stripKeyPrefix(provider.value, value)
  }
})

watch(
  () => messages.value.length,
  () => void scrollToEnd(),
)

watch([baseUrl, provider], () => {
  if (provider.value === 'other' && keyReady.value) scheduleLoadModels()
})

const setProvider = (next: AiProvider) => {
  if (provider.value === next) return
  provider.value = next
  model.value = defaultModels.value[next]
  apiKeyBody.value = ''
  if (next !== 'other') baseUrl.value = ''
  modelsError.value = ''
  clearModelList()
  settingsOpen.value = true
}

const useNvidiaPreset = () => {
  baseUrl.value = NVIDIA_BASE
}

const onKeyPaste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!text) return
  event.preventDefault()
  apiKeyBody.value = stripKeyPrefix(provider.value, text)
}

const useExample = (text: string) => {
  draft.value = text
}

const saveSettings = () => {
  apiKeyBody.value = apiKeyBody.value.replace(/\s+/g, '')
  if (!keyReady.value) {
    toast(
      isOther.value
        ? 'API 키와 https 베이스 URL을 입력해 주세요.'
        : 'API 키를 입력해 주세요.',
      { kind: 'error' },
    )
    return
  }
  persistSettings()
  settingsOpen.value = false
  toast('AI 설정을 이 기기에 저장했어요')
  void loadModels({ force: true })
}

const clearSettings = () => {
  apiKeyBody.value = ''
  model.value = defaultModels.value[provider.value]
  if (provider.value === 'other') baseUrl.value = ''
  clearModelList()
  persistSettings()
  settingsOpen.value = true
  toast('AI 설정을 지웠어요')
}

const clearChat = () => {
  messages.value = []
}

const send = async () => {
  apiKeyBody.value = apiKeyBody.value.replace(/\s+/g, '')
  const text = draft.value.trim()
  if (!canSend.value) {
    const msg = !keyReady.value
      ? isOther.value
        ? 'API 키와 베이스 URL을 설정해 주세요.'
        : 'API 키를 입력한 뒤에 대화할 수 있어요.'
      : !model.value.trim()
        ? '모델을 선택해 주세요.'
        : '메시지를 입력해 주세요.'
    toast(msg, { kind: 'error' })
    if (!keyReady.value || !model.value.trim()) settingsOpen.value = true
    return
  }
  const history = messages.value.slice(-6).map((item) => ({
    role: item.role,
    content: item.content,
  }))
  const userMsg: ChatMsg = {
    id: `u-${++msgSeq}`,
    role: 'user',
    content: text,
  }
  messages.value = [...messages.value, userMsg]
  draft.value = ''
  busy.value = true
  try {
    persistSettings()
    const payload: Record<string, unknown> = {
      message: text,
      apiKey: fullApiKey.value,
      provider: provider.value,
      model: model.value.trim(),
      document: toAiRequestDocument(props.document),
      history,
    }
    if (provider.value === 'other') payload.baseUrl = baseUrl.value.trim()
    const result = await api<{
      message: string
      document?: ErdDocument
      applied: boolean
      source: AiProvider
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    messages.value = [
      ...messages.value,
      {
        id: `a-${++msgSeq}`,
        role: 'assistant',
        content: result.message || '반영했어요.',
        applied: result.applied,
      },
    ]
    if (result.applied && result.document) {
      emit('apply', result.document)
      toast('다이어그램에 반영했어요')
    }
  } catch (e) {
    const msg = errorMessage(e, '답변을 받지 못했어요')
    messages.value = [
      ...messages.value,
      {
        id: `a-${++msgSeq}`,
        role: 'assistant',
        content: msg,
      },
    ]
  } finally {
    busy.value = false
    void scrollToEnd()
  }
}

const onDraftKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  if (coarsePointer()) return
  event.preventDefault()
  void send()
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="shrink-0 space-y-2">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-left transition-colors hover:bg-secondary"
        :aria-expanded="settingsOpen"
        @click="settingsOpen = !settingsOpen"
      >
        <span class="min-w-0">
          <span class="block text-[13px] font-bold tracking-[-0.01em]">AI 설정</span>
          <span class="mt-0.5 block truncate text-[12px] text-muted-foreground">
            {{ activeProvider.label }}
            <template v-if="model"> · {{ model }}</template>
            <template v-if="!keyReady"> · 키 필요</template>
          </span>
        </span>
        <ChevronDown
          class="size-4 shrink-0 text-muted-foreground transition-transform"
          :class="settingsOpen ? 'rotate-180' : ''"
          aria-hidden="true"
        />
      </button>
      <div
        v-if="settingsOpen"
        class="max-h-[min(42vh,18rem)] space-y-2 overflow-y-auto overscroll-contain rounded-xl bg-muted/60 p-3"
      >
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="(meta, id) in PROVIDERS"
            :key="id"
            type="button"
            class="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
            :class="provider === id ? meta.activeClass : meta.idleClass"
            :disabled="readOnly || busy"
            :aria-pressed="provider === id"
            @click="setProvider(id)"
          >
            <svg
              v-if="id === 'openai'"
              class="size-3.5 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
            >
              <path
                d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.771-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.76a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.761a.771.771 0 0 0 .78 0l5.843-3.373v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.844-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.306 12.863l-2.02-1.163a.08.08 0 0 1-.038-.057V6.074a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365L12 8.704l2.597 1.498v2.999L12 14.7l-2.597-1.499z"
              />
            </svg>
            <svg
              v-else-if="id === 'gemini'"
              class="size-3.5 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
            >
              <path
                d="M12 2.04c.4 0 .73.27.84.65l1.55 5.33c.2.68.73 1.21 1.41 1.41l5.33 1.55c.38.11.65.44.65.84s-.27.73-.65.84l-5.33 1.55c-.68.2-1.21.73-1.41 1.41l-1.55 5.33c-.11.38-.44.65-.84.65s-.73-.27-.84-.65l-1.55-5.33a2.1 2.1 0 0 0-1.41-1.41L2.84 12.2A.88.88 0 0 1 2.2 11.36c0-.4.27-.73.65-.84l5.33-1.55c.68-.2 1.21-.73 1.41-1.41L11.14 2.7c.11-.38.44-.65.84-.65zm6.5 12.46c.26 0 .48.17.56.42l.58 1.98c.1.34.36.6.7.7l1.98.58c.25.08.42.3.42.56s-.17.48-.42.56l-1.98.58c-.34.1-.6.36-.7.7l-.58 1.98a.58.58 0 0 1-.56.42c-.26 0-.48-.17-.56-.42l-.58-1.98a1.05 1.05 0 0 0-.7-.7l-1.98-.58a.58.58 0 0 1-.42-.56c0-.26.17-.48.42-.56l1.98-.58c.34-.1.6-.36.7-.7l.58-1.98c.08-.25.3-.42.56-.42z"
              />
            </svg>
            <Ellipsis v-else class="size-3.5 shrink-0" aria-hidden="true" />
            {{ meta.label }}
          </button>
        </div>
        <template v-if="isOther">
          <div class="flex items-center justify-between gap-2">
            <label class="text-[12px] font-semibold text-muted-foreground" for="ai-base-url">
              베이스 URL
            </label>
            <button
              type="button"
              class="min-h-9 px-1 text-[12px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              :disabled="readOnly || busy"
              @click="useNvidiaPreset"
            >
              NVIDIA 예시
            </button>
          </div>
          <Input
            id="ai-base-url"
            v-model="baseUrl"
            class="h-11 text-base"
            :disabled="readOnly || busy"
            placeholder="https://integrate.api.nvidia.com/v1"
            aria-label="OpenAI 호환 베이스 URL"
          />
        </template>
        <PasswordInput
          id="ai-api-key"
          v-model="apiKeyBody"
          class="h-11 overflow-hidden rounded-xl bg-muted transition-colors focus-within:bg-card focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/30"
          :prefix="keyPrefix || undefined"
          :disabled="readOnly || busy"
          autocomplete="off"
          spellcheck="false"
          :placeholder="activeProvider.keyHint"
          :aria-label="keyPrefix ? `AI API 키 (${keyPrefix} 접두사 고정)` : 'AI API 키'"
          @paste="onKeyPaste"
        />
        <div class="flex items-center justify-between gap-2">
          <label class="text-[12px] font-semibold text-muted-foreground" for="ai-model">
            모델
          </label>
          <button
            type="button"
            class="inline-flex min-h-9 items-center gap-1 px-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            :disabled="readOnly || busy || !keyReady || modelsLoading"
            @click="loadModels({ force: true })"
          >
            <RefreshCw
              class="size-3.5"
              :class="modelsLoading ? 'animate-spin' : ''"
              aria-hidden="true"
            />
            {{ modelsLoading ? '불러오는 중' : '새로고침' }}
          </button>
        </div>
        <Select
          v-if="modelOptions.length"
          id="ai-model"
          v-model="model"
          class="h-11 text-base"
          :disabled="readOnly || busy || !keyReady || modelsLoading"
          :options="modelOptions"
          aria-label="AI 모델"
        />
        <Input
          v-else
          id="ai-model"
          v-model="model"
          class="h-11 text-base"
          :disabled="readOnly || busy || !keyReady"
          :placeholder="
            isOther
              ? 'meta/llama-3.1-70b-instruct'
              : activeProvider.defaultModel || '모델 id'
          "
          aria-label="AI 모델"
        />
        <p v-if="modelsError" class="text-[12px] text-destructive">{{ modelsError }}</p>
        <div class="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            class="h-11 flex-1 px-3"
            :disabled="readOnly || busy || !keyReady"
            @click="saveSettings"
          >
            {{ saved ? '설정 저장됨' : '설정 저장' }}
          </Button>
          <Button
            type="button"
            variant="secondary"
            class="h-11 px-3"
            :disabled="
              readOnly || busy || (!apiKeyBody && !model && !baseUrl && !saved)
            "
            @click="clearSettings"
          >
            지우기
          </Button>
        </div>
      </div>
    </div>

    <div
      ref="scroller"
      class="min-h-0 flex-1 space-y-2 overflow-auto overscroll-contain"
    >
      <div v-if="!messages.length" class="space-y-3 py-1">
        <p class="text-[13px] leading-5 text-muted-foreground">
          만들고 싶은 스키마를 말하거나, 지금 다이어그램을 어떻게 고칠지 이어서 대화해요.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="item in examples"
            :key="item"
            type="button"
            class="rounded-full bg-muted px-3.5 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            :disabled="readOnly || busy || !keyReady"
            @click="useExample(item)"
          >
            {{ item }}
          </button>
        </div>
      </div>
      <div
        v-for="item in messages"
        :key="item.id"
        class="flex"
        :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5"
          :class="
            item.role === 'user'
              ? 'bg-foreground text-background'
              : 'bg-muted text-foreground'
          "
        >
          <p class="whitespace-pre-wrap break-words">{{ item.content }}</p>
          <p
            v-if="item.role === 'assistant' && item.applied"
            class="mt-1.5 text-[11px] font-semibold opacity-70"
          >
            캔버스에 반영됨
          </p>
        </div>
      </div>
      <p v-if="busy" class="text-[12px] text-muted-foreground">생각 중…</p>
    </div>

    <div ref="composer" class="shrink-0 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-[12px] text-muted-foreground">
          {{ keyReady ? '대화로 계속 수정할 수 있어요' : '먼저 API 키를 설정해 주세요' }}
        </p>
        <button
          v-if="messages.length"
          type="button"
          class="min-h-9 px-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          :disabled="busy"
          @click="clearChat"
        >
          대화 지우기
        </button>
      </div>
      <Textarea
        v-model="draft"
        class="min-h-[4.5rem] text-base"
        :disabled="readOnly || busy || !keyReady"
        placeholder="예: 댓글에 작성일 컬럼 추가해 줘"
        aria-label="AI 메시지"
        @focus="revealComposer"
        @keydown="onDraftKeydown"
      />
      <Button
        class="h-11 w-full shrink-0 gap-2"
        :disabled="!canSend"
        @click="send"
      >
        <SendHorizontal class="size-4" aria-hidden="true" />
        {{ busy ? '보내는 중…' : '보내기' }}
      </Button>
    </div>
  </div>
</template>
