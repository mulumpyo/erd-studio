import {
  columnTypeLabel,
  type ErdDocument,
  type ErdDomain,
} from '@erd-studio/shared'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const yn = (value: boolean) => (value ? 'Y' : '')

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`

export const specRows = (doc: ErdDocument) => {
  const rows: string[][] = [
    [
      '테이블 논리명',
      '테이블 물리명',
      '컬럼 논리명',
      '컬럼 물리명',
      '도메인',
      '타입',
      'PK',
      'FK',
      'NN',
      'UQ',
      'AI',
      '기본값',
      '설명',
    ],
  ]
  for (const table of doc.tables) {
    for (const col of table.columns) {
      const domain = doc.domains.find((item) => item.id === col.domainId)
      rows.push([
        table.logicalName,
        table.physicalName,
        col.logicalName,
        col.physicalName,
        domain?.name ?? '',
        columnTypeLabel(col, doc.domains),
        yn(col.pk),
        yn(col.fk),
        yn(col.nn),
        yn(col.unique),
        yn(col.autoIncrement),
        col.defaultValue ?? '',
        col.comment ?? table.comment ?? '',
      ])
    }
  }
  return rows
}

export const buildSpecCsv = (doc: ErdDocument) =>
  `\uFEFF${specRows(doc)
    .map((row) => row.map(csvCell).join(','))
    .join('\n')}\n`

const domainTable = (domains: ErdDomain[]) => {
  if (!domains.length) return ''
  const body = domains
    .map(
      (domain) => `<tr>
        <td>${escapeHtml(domain.name)}</td>
        <td>${escapeHtml(domain.type)}${domain.length ? `(${escapeHtml(domain.length)})` : ''}</td>
        <td>${yn(domain.nn)}</td>
      </tr>`,
    )
    .join('')
  return `<h2>도메인</h2>
    <table>
      <thead><tr><th>이름</th><th>타입</th><th>NN</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`
}

export const buildSpecHtml = (doc: ErdDocument, title: string) => {
  const tables = doc.tables
    .map((table) => {
      const cols = table.columns
        .map((col) => {
          const domain = doc.domains.find((item) => item.id === col.domainId)
          return `<tr>
            <td>${escapeHtml(col.logicalName)}</td>
            <td>${escapeHtml(col.physicalName)}</td>
            <td>${escapeHtml(domain?.name ?? '')}</td>
            <td>${escapeHtml(columnTypeLabel(col, doc.domains))}</td>
            <td>${yn(col.pk)}</td>
            <td>${yn(col.fk)}</td>
            <td>${yn(col.nn)}</td>
            <td>${yn(col.unique)}</td>
            <td>${yn(col.autoIncrement)}</td>
            <td>${escapeHtml(col.defaultValue ?? '')}</td>
            <td>${escapeHtml(col.comment ?? '')}</td>
          </tr>`
        })
        .join('')
      return `<section>
        <h2>${escapeHtml(table.logicalName)} <small>${escapeHtml(table.physicalName)}</small></h2>
        ${table.comment ? `<p>${escapeHtml(table.comment)}</p>` : ''}
        <table>
          <thead>
            <tr>
              <th>논리명</th><th>물리명</th><th>도메인</th><th>타입</th>
              <th>PK</th><th>FK</th><th>NN</th><th>UQ</th><th>AI</th>
              <th>기본값</th><th>설명</th>
            </tr>
          </thead>
          <tbody>${cols}</tbody>
        </table>
      </section>`
    })
    .join('')

  const relations = doc.relations
    .map((rel) => {
      const source = doc.tables.find((t) => t.id === rel.sourceTableId)
      const target = doc.tables.find((t) => t.id === rel.targetTableId)
      if (!source || !target) return ''
      const srcCol =
        source.columns.find((c) => c.id === rel.sourceColumnIds[0])
          ?.physicalName ?? ''
      const tgtCol =
        target.columns.find((c) => c.id === rel.targetColumnIds[0])
          ?.physicalName ?? ''
      return `<tr>
        <td>${escapeHtml(rel.name || '')}</td>
        <td>${escapeHtml(source.physicalName)}.${escapeHtml(srcCol)}</td>
        <td>${escapeHtml(target.physicalName)}.${escapeHtml(tgtCol)}</td>
        <td>${rel.kind === 'identifying' ? '식별' : '비식별'}</td>
        <td>${rel.sourceCardinality}:${rel.targetCardinality}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} 테이블 명세서</title>
  <style>
    body { font-family: Pretendard, sans-serif; margin: 32px; color: #0f172a; }
    h1 { font-size: 22px; }
    h2 { font-size: 16px; margin-top: 28px; }
    h2 small { font-weight: 400; color: #64748b; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)} 테이블 명세서</h1>
  ${domainTable(doc.domains)}
  ${tables}
  <h2>관계</h2>
  <table>
    <thead>
      <tr><th>이름</th><th>부모</th><th>자식</th><th>종류</th><th>기수</th></tr>
    </thead>
    <tbody>${relations || '<tr><td colspan="5">없음</td></tr>'}</tbody>
  </table>
</body>
</html>`
}
