const { execSync } = require('child_process')
const fs = require('fs')

const files = [
  'apps/api/src/services/ai-chat-context.test.ts',
  'apps/api/src/services/ai.service.chat.test.ts',
]

for (const f of files) {
  const buf = execSync(`git show fb8d3e5:${f}`)
  let text = buf.toString('utf8')
  const nulls = (text.match(/length: null/g) || []).length
  const sample = text.match(/logicalName: '[^']*'/)
  console.log(f, 'nulls=', nulls, 'sample=', sample && sample[0])
  text = text.replaceAll('length: null', 'length: undefined')
  fs.writeFileSync(f, text, 'utf8')
}
