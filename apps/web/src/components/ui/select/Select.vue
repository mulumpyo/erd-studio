<script setup lang="ts">
import {
  Comment,
  Fragment,
  Text,
  computed,
  onBeforeMount,
  onBeforeUpdate,
  shallowRef,
  useSlots,
  type HTMLAttributes,
  type VNode,
  type VNodeChild,
} from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { Check, ChevronDown } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { useVModel } from '@vueuse/core'

defineOptions({ inheritAttrs: false })

export type SelectOption = { value: string; label: string }

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  options?: SelectOption[]
  class?: HTMLAttributes['class']
  disabled?: boolean
}>()
const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()
const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})

const slots = useSlots()
const open = shallowRef(false)
const slotOptions = shallowRef<SelectOption[]>([])

const vnodeText = (children: VNodeChild): string => {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) return children.map(vnodeText).join('')
  if (typeof children === 'object' && children && 'children' in children) {
    return vnodeText((children as VNode).children as VNodeChild)
  }
  return ''
}

const parseOptions = (items: VNodeChild[]): SelectOption[] => {
  const out: SelectOption[] = []
  const walk = (nodes: VNodeChild[]) => {
    for (const node of nodes) {
      if (node == null || typeof node === 'boolean') continue
      if (typeof node === 'string' || typeof node === 'number') continue
      if (Array.isArray(node)) {
        walk(node)
        continue
      }
      const vnode = node as VNode
      if (vnode.type === Comment || vnode.type === Text) continue
      if (vnode.type === Fragment) {
        walk(Array.isArray(vnode.children) ? vnode.children : [])
        continue
      }
      const nodeProps = (vnode.props ?? {}) as Record<string, unknown>
      if (vnode.type === 'option' || 'value' in nodeProps) {
        const raw = nodeProps.value
        const value = raw == null ? '' : String(raw)
        out.push({
          value,
          label: vnodeText(vnode.children as VNodeChild).trim() || value,
        })
      }
    }
  }
  walk(items)
  return out
}

const readSlotOptions = () => {
  slotOptions.value = parseOptions(slots.default?.() ?? [])
}

onBeforeMount(readSlotOptions)
onBeforeUpdate(readSlotOptions)

const resolvedOptions = computed(() =>
  props.options?.length ? props.options : slotOptions.value,
)

const selectedLabel = computed(() => {
  const value = modelValue.value == null ? '' : String(modelValue.value)
  return (
    resolvedOptions.value.find((option) => option.value === value)?.label ??
    value
  )
})

const choose = (value: string) => {
  modelValue.value = value
  open.value = false
}
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger
      :disabled="disabled"
      :class="
        cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-2xl border-0 bg-muted px-4 text-left text-base font-medium tracking-[-0.01em] text-foreground shadow-none outline-none transition-colors',
          'hover:bg-muted/80 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180',
          props.class,
        )
      "
    >
      <span class="min-w-0 truncate">{{ selectedLabel }}</span>
      <ChevronDown />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="start"
        :side-offset="6"
        class="z-[200] max-h-72 overflow-y-auto rounded-2xl border-0 bg-card p-1.5 shadow-[0_8px_32px_rgb(25_31_40_/_0.14)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        :style="{ minWidth: 'var(--reka-popper-anchor-width)' }"
      >
        <DropdownMenuItem
          v-for="option in resolvedOptions"
          :key="option.value"
          class="flex cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-[14px] font-medium outline-none data-[highlighted]:bg-muted"
          @select="choose(option.value)"
        >
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <Check
            v-if="String(modelValue ?? '') === option.value"
            class="size-4 shrink-0 text-primary"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
