<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    class?: HTMLAttributes['class']
    label?: string
  }>(),
  { size: 'md', label: '불러오고 있어요' },
)

const px = { sm: 20, md: 28, lg: 36 }
</script>

<template>
  <div
    role="status"
    :aria-label="label || '불러오고 있어요'"
    :class="cn('flex flex-col items-center justify-center gap-3', $props.class)"
  >
    <span
      class="toss-loader shrink-0 text-primary"
      :class="`toss-loader--${size}`"
      :style="{ width: `${px[size]}px`, height: `${px[size]}px` }"
      aria-hidden="true"
    />
    <p
      v-if="label"
      class="whitespace-pre-line text-center text-[15px] font-medium leading-snug tracking-[-0.02em] text-muted-foreground"
    >
      {{ label }}
    </p>
  </div>
</template>

<style>
.toss-loader {
  display: block;
  border-radius: 50%;
  background: conic-gradient(from 200deg, transparent 8%, currentColor 92%);
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    #000 calc(100% - 2.5px)
  );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    #000 calc(100% - 2.5px)
  );
  animation: toss-loader-spin 0.72s linear infinite;
}

.toss-loader--sm {
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 2.5px),
    #000 calc(100% - 2px)
  );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 2.5px),
    #000 calc(100% - 2px)
  );
}

.toss-loader--lg {
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3.5px),
    #000 calc(100% - 3px)
  );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3.5px),
    #000 calc(100% - 3px)
  );
}

@keyframes toss-loader-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toss-loader {
    animation: none;
    background: conic-gradient(from 200deg, transparent 32%, currentColor 100%);
  }
}
</style>
