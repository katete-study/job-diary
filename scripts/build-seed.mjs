// seed/private/{jobs.json, todos.json, docs.md} → seed/private/seed.json 변환 스크립트.
// 결과 파일은 앱의 "설정 · 백업 → 백업 불러오기"로 가져온다. seed/private/ 는 git에 올라가지 않는다.
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const dir = new URL('../seed/private/', import.meta.url)
const now = Date.now()
const read = (name) => readFileSync(new URL(name, dir), 'utf8')

const jobs = JSON.parse(read('jobs.json')).map((j, i) => ({
  url: '',
  source: 'other',
  favorite: false,
  createdAt: now + i,
  updatedAt: now + i,
  ...j,
}))

const todos = JSON.parse(read('todos.json')).map((t, i) => ({
  id: `todo-${String(i + 1).padStart(2, '0')}`,
  done: false,
  createdAt: now + i,
  updatedAt: now + i,
  ...t,
}))

/** docs.md: "@@@ key=value | key=value ..." 헤더 줄 + 본문을 다음 헤더까지 */
const docs = read('docs.md')
  .split(/^@@@ /m)
  .filter((chunk) => chunk.trim())
  .map((chunk, i) => {
    const nl = chunk.indexOf('\n')
    const header = Object.fromEntries(
      chunk
        .slice(0, nl)
        .split(' | ')
        .map((kv) => {
          const at = kv.indexOf('=')
          return [kv.slice(0, at).trim(), kv.slice(at + 1).trim()]
        }),
    )
    return {
      id: header.id ?? randomUUID(),
      type: header.type,
      title: header.title,
      jobId: header.job ?? '',
      date: header.date,
      content: chunk.slice(nl + 1).trim(),
      includeInContext: true,
      createdAt: now + i,
      updatedAt: now + i,
    }
  })

writeFileSync(new URL('seed.json', dir), JSON.stringify({ version: 1, jobs, docs, todos }, null, 2))
console.log(`jobs ${jobs.length} · docs ${docs.length} · todos ${todos.length} → seed/private/seed.json`)
