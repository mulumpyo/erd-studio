<script setup lang="ts">
import { ref } from 'vue'
import { generateSql, parseSql, type SqlDialect } from '@erd-studio/sql'
import type { ErdDocument } from '@erd-studio/shared'
import { errorMessage } from '@/lib/format'
import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { confirm } from '@/composables/useConfirm'

const props = defineProps<{ document: ErdDocument; readOnly?: boolean }>()
const emit = defineEmits<{ (e: 'import', doc: ErdDocument): void }>()
const dialect = ref<SqlDialect>('mysql')
const sql = ref('')
const error = ref('')
const dialects: { value: SqlDialect; label: string }[] = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mssql', label: 'MS-SQL' },
  { value: 'oracle', label: 'Oracle' },
]

const exportSql = () => {
  sql.value = generateSql(props.document, dialect.value)
  error.value = ''
}

const importSql = async () => {
  if (props.readOnly) return
  if (props.document.tables.length || props.document.notes.length) {
    const ok = await confirm({
      title: '다이어그램을 바꿀까요?',
      description: '지금 그린 내용이 이 SQL로 바뀌어요.',
      confirmLabel: '바꾸기',
      destructive: true,
    })
    if (!ok) return
  }
  try {
    emit('import', parseSql(sql.value, dialect.value))
    error.value = ''
  } catch (e) {
    error.value = errorMessage(e, 'SQL을 가져오지 못했어요')
  }
}

const download = () => {
  const blob = new Blob(
    [sql.value || generateSql(props.document, dialect.value)],
    { type: 'text/sql' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `erd-studio.${dialect.value}.sql`
  a.click()
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <Select v-model="dialect" :options="dialects" class="h-12 shrink-0" />
    <Button class="h-12 w-full shrink-0" @click="exportSql">내보내기</Button>
    <Textarea
      v-model="sql"
      class="min-h-32 flex-1 font-mono text-xs"
    />
    <div class="grid shrink-0 grid-cols-2 gap-2">
      <Button
        class="h-12"
        variant="secondary"
        :disabled="readOnly"
        @click="importSql"
        >가져오기</Button
      >
      <Button class="h-12" variant="secondary" @click="download"
        >파일로 저장</Button
      >
    </div>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
