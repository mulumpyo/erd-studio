<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { buttonVariants } from '@/components/ui/button'
</script>

<template>
  <div class="flex min-h-full flex-col bg-background">
    <header class="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
      <div class="flex items-center gap-2.5">
        <div
          class="flex size-9 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-white"
        >
          E
        </div>
        <span class="text-[17px] font-bold tracking-[-0.03em]">ERD Studio</span>
        <ThemeToggle />
      </div>
      <div class="flex items-center gap-2">
        <RouterLink
          :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
          to="/login"
          >로그인</RouterLink
        >
        <RouterLink :class="buttonVariants({ size: 'sm' })" to="/register"
          >시작하기</RouterLink
        >
      </div>
    </header>
    <div class="mx-auto w-full max-w-5xl flex-1 px-6 pb-16 pt-10">
      <p class="text-[15px] font-semibold text-primary">팀과 함께 그리는 ERD</p>
      <h1
        class="mt-3 max-w-2xl text-[44px] font-bold leading-[1.2] tracking-[-0.05em] sm:text-[56px]"
      >
        데이터베이스 설계,<br />더 쉽고 빠르게
      </h1>
      <p
        class="mt-5 max-w-lg text-[17px] leading-7 text-muted-foreground"
      >
        브라우저에서 테이블을 그리고, SQL로 주고받고, 팀원과 바로 같이 수정해요.
      </p>
      <div class="mt-10 flex flex-wrap gap-3">
        <RouterLink :class="buttonVariants({ size: 'lg' })" to="/register"
          >무료로 시작</RouterLink
        >
        <RouterLink
          :class="buttonVariants({ variant: 'secondary', size: 'lg' })"
          to="/login"
          >로그인</RouterLink
        >
      </div>
      <div class="mt-20 grid gap-3 md:grid-cols-3">
        <div class="rounded-[24px] bg-card px-6 py-7">
          <div
            class="mb-4 flex size-10 items-center justify-center rounded-2xl bg-accent text-[15px] font-bold text-accent-foreground"
          >
            1
          </div>
          <h3 class="text-[18px] font-bold">캔버스 에디터</h3>
          <p class="mt-2 text-[15px] leading-6 text-muted-foreground">
            논리/물리명, PK·FK, 식별·비식별 관계까지 한 화면에서 그려요.
          </p>
        </div>
        <div class="rounded-[24px] bg-card px-6 py-7">
          <div
            class="mb-4 flex size-10 items-center justify-center rounded-2xl bg-accent text-[15px] font-bold text-accent-foreground"
          >
            2
          </div>
          <h3 class="text-[18px] font-bold">실시간 협업</h3>
          <p class="mt-2 text-[15px] leading-6 text-muted-foreground">
            테이블을 옮기면 팀원 화면에 바로 반영되고, 채팅도 같이 따라가요.
          </p>
        </div>
        <div class="rounded-[24px] bg-card px-6 py-7">
          <div
            class="mb-4 flex size-10 items-center justify-center rounded-2xl bg-accent text-[15px] font-bold text-accent-foreground"
          >
            3
          </div>
          <h3 class="text-[18px] font-bold">권한 관리</h3>
          <p class="mt-2 text-[15px] leading-6 text-muted-foreground">
            팀뿐 아니라 다이어그램마다 편집 권한을 따로 줄 수 있어요.
          </p>
        </div>
      </div>
    </div>
    <footer
      class="border-t border-border/80 px-6 py-6 text-center text-[13px] text-muted-foreground"
    >
      Copyright &copy; 2026 mulumpyo. All Rights Reserved.
    </footer>
  </div>
</template>
