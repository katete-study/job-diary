// seed/private/notion/{jobs.json, todos.json, docs.md} → seed/private/notion-update.json
// jobs.json 은 기존 seed 공고에 id가 있으면 "덮어쓸 필드만"(패치), 없으면 새 공고로 취급한다.
// 결과 파일은 앱의 "설정 · 백업 → 백업 불러오기"로 가져온다. seed/private/ 는 git에 올라가지 않는다.
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../seed/private/', import.meta.url)
const read = (name) => readFileSync(new URL(name, dir), 'utf8')
const now = Date.now()

const base = new Map(JSON.parse(read('jobs.json')).map((j) => [j.id, j]))
const defaults = { url: '', source: 'other', favorite: false, eventDate: '', interviewAt: '' }

const jobs = JSON.parse(read('notion/jobs.json')).map((patch, i) => ({
  ...defaults,
  ...(base.get(patch.id) ?? {}),
  ...patch,
  createdAt: now + i,
  updatedAt: now + i,
}))

const todos = JSON.parse(read('notion/todos.json')).map((t, i) => ({ done: false, createdAt: now + i, updatedAt: now + i, ...t }))

const docs = read('notion/docs.md')
  .split(/^@@@ /m)
  .filter((c) => c.trim())
  .map((chunk, i) => {
    const nl = chunk.indexOf('\n')
    const h = Object.fromEntries(
      chunk
        .slice(0, nl)
        .split(' | ')
        .map((kv) => [kv.slice(0, kv.indexOf('=')).trim(), kv.slice(kv.indexOf('=') + 1).trim()]),
    )
    return { id: h.id, type: h.type, title: h.title, jobId: h.job ?? '', date: h.date, content: chunk.slice(nl + 1).trim(), includeInContext: true, createdAt: now + i, updatedAt: now + i }
  })

writeFileSync(new URL('notion-update.json', dir), JSON.stringify({ version: 1, jobs, docs, todos }, null, 2))
console.log(`jobs ${jobs.length}(수정 ${jobs.filter((j) => base.has(j.id)).length} + 신규 ${jobs.filter((j) => !base.has(j.id)).length}) · docs ${docs.length} · todos ${todos.length}`)
