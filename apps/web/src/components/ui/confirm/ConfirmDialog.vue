<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { DialogRoot } from 'reka-ui'
import { useConfirm } from '@/composables/useConfirm'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'

const {
  open,
  request,
  typed,
  matchRequired,
  matchOk,
  typedMismatch,
  noticeOnly,
  close,
} = useConfirm()

watch(open, async (next) => {
  if (!next || !matchRequired.value) return
  await nextTick()
  document.querySelector<HTMLInputElement>('[data-confirm-match]')?.focus()
})

const onOpenChange = (next: boolean) => {
  if (!next) close(false)
}

const submit = () => {
  if (matchRequired.value && !matchOk.value) return
  close(true)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogContent nested alert>
      <DialogTitle class="pr-1 text-[20px] leading-7">
        {{ request?.title }}
      </DialogTitle>
      <p
        v-if="request?.description"
        class="mt-4 text-[15px] leading-6 text-muted-foreground"
      >
        {{ request.description }}
      </p>
      <form v-if="request" class="mt-6 space-y-4" @submit.prevent="submit">
        <div v-if="matchRequired" class="space-y-2">
          <div class="rounded-2xl bg-muted px-4 py-3">
            <p class="text-[13px] font-semibold text-muted-foreground">
              {{ request.matchHint || '아래 이름을 그대로 입력해 주세요' }}
            </p>
            <p class="mt-1 break-all text-[17px] font-bold tracking-[-0.03em]">
              {{ request.matchValue }}
            </p>
          </div>
          <Label class="sr-only" for="confirm-match">이름 확인</Label>
          <Input
            id="confirm-match"
            v-model="typed"
            data-confirm-match
            placeholder="위에 있는 문구를 그대로 입력"
            autocomplete="off"
            spellcheck="false"
            :class="
              typedMismatch
                ? 'ring-2 ring-destructive/40 focus-visible:ring-destructive/50'
                : ''
            "
          />
          <p v-if="typedMismatch" class="text-[13px] font-semibold text-destructive">
            문구가 같지 않아요
          </p>
        </div>
        <div
          class="grid gap-2"
          :class="noticeOnly ? 'grid-cols-1' : 'grid-cols-2'"
        >
          <Button
            v-if="!noticeOnly"
            type="button"
            variant="secondary"
            @click="close(false)"
          >
            {{ request.cancelLabel || '취소' }}
          </Button>
          <Button
            type="submit"
            :variant="request.destructive ? 'destructive' : 'default'"
            :disabled="matchRequired && !matchOk"
          >
            {{ request.confirmLabel || '확인' }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </DialogRoot>
</template>
