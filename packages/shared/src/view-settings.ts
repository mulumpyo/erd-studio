export type NameMode = 'both' | 'logical' | 'physical'

export type ErdShowKey =
  | 'tableComment'
  | 'columnDomain'
  | 'columnType'
  | 'columnNotNull'
  | 'columnDefault'
  | 'columnComment'
  | 'columnUnique'
  | 'columnAutoIncrement'

export type ErdShowFlags = Record<ErdShowKey, boolean>

export type ErdViewSettings = {
  nameMode: NameMode
  show: ErdShowFlags
}

export type ErdViewPatch = {
  nameMode?: NameMode
  show?: Partial<ErdShowFlags>
}

export const ERD_SHOW_OPTIONS: Array<{
  key: ErdShowKey
  label: string
  hint: string
}> = [
  { key: 'tableComment', label: '테이블 설명', hint: '테이블 헤더 아래 코멘트를 보여요' },
  { key: 'columnDomain', label: '도메인', hint: '컬럼에 연결한 도메인 이름을 보여요' },
  { key: 'columnType', label: '타입', hint: 'varchar, int 같은 자료형을 보여요' },
  { key: 'columnNotNull', label: 'Null 허용', hint: 'N / NN으로 비어 있을 수 있는지 보여요' },
  { key: 'columnDefault', label: '기본값', hint: '값이 없을 때 들어가는 기본값을 보여요' },
  { key: 'columnComment', label: '코멘트', hint: '컬럼 설명을 보여요' },
  { key: 'columnUnique', label: '고유', hint: 'UQ 표시를 보여요' },
  { key: 'columnAutoIncrement', label: '자동 증가', hint: 'AI 표시를 보여요' },
]

export const defaultShowFlags = (): ErdShowFlags => ({
  tableComment: false,
  columnDomain: false,
  columnType: true,
  columnNotNull: true,
  columnDefault: false,
  columnComment: false,
  columnUnique: true,
  columnAutoIncrement: true,
})

export const defaultViewSettings = (): ErdViewSettings => ({
  nameMode: 'both',
  show: defaultShowFlags(),
})

const isNameMode = (value: unknown): value is NameMode =>
  value === 'both' || value === 'logical' || value === 'physical'

export const normalizeViewSettings = (
  value?: Partial<ErdViewSettings> | null,
): ErdViewSettings => {
  const defaults = defaultViewSettings()
  const show = (value?.show ?? {}) as Partial<ErdShowFlags>
  return {
    nameMode: isNameMode(value?.nameMode) ? value.nameMode : defaults.nameMode,
    show: {
      tableComment: Boolean(show.tableComment ?? defaults.show.tableComment),
      columnDomain: Boolean(show.columnDomain ?? defaults.show.columnDomain),
      columnType: Boolean(show.columnType ?? defaults.show.columnType),
      columnNotNull: Boolean(show.columnNotNull ?? defaults.show.columnNotNull),
      columnDefault: Boolean(show.columnDefault ?? defaults.show.columnDefault),
      columnComment: Boolean(show.columnComment ?? defaults.show.columnComment),
      columnUnique: Boolean(show.columnUnique ?? defaults.show.columnUnique),
      columnAutoIncrement: Boolean(
        show.columnAutoIncrement ?? defaults.show.columnAutoIncrement,
      ),
    },
  }
}

export const mergeViewSettings = (
  base: ErdViewSettings,
  patch?: ErdViewPatch | null,
): ErdViewSettings => {
  if (!patch) return base
  return normalizeViewSettings({
    nameMode: patch.nameMode ?? base.nameMode,
    show: { ...base.show, ...patch.show },
  })
}

export const viewHasExtraColumns = (show: ErdShowFlags) =>
  show.columnDomain ||
  show.columnDefault ||
  show.columnComment ||
  show.tableComment
