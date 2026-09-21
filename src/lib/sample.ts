import type { CollectionName, DocEntry, Entity, Job, Todo } from './types'
import { toDateStr } from './util'

/**
 * 소유자가 아닌 방문자에게 "블러 처리된 화면"의 모양만 보여 주기 위한 가짜 데이터.
 * 실제 데이터와는 무관하며, 진짜 데이터는 Firestore 규칙 때문에 애초에 내려오지 않는다.
 */
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return toDateStr(d)
}

const base = { createdAt: 0, updatedAt: 0 }

const job = (i: number, p: Partial<Job>): Job => ({
  ...base,
  id: `sample-job-${i}`,
  url: '',
  source: 'other',
  company: `회사 ${String.fromCharCode(64 + i)}`,
  title: '앱 개발자 (신입)',
  deadline: day(i + 1),
  interviewAt: '',
  eventDate: '',
  status: 'submitted',
  applied: true,
  favorite: false,
  note: '샘플 메모입니다',
  ...p,
})

const SAMPLE_JOBS: Job[] = [
  job(1, { status: 'submitted', eventDate: day(-1) }),
  job(2, { status: 'rejected', eventDate: day(-4) }),
  job(3, { status: 'writing', applied: false, deadline: day(3) }),
  job(4, { status: 'planned', applied: false, deadline: day(8) }),
  job(5, { status: 'interview', interviewAt: day(6), deadline: '' }),
  job(6, { status: 'considering', applied: false, deadline: day(12) }),
  job(7, { status: 'hold', applied: false, deadline: day(15) }),
]

const SAMPLE_DOCS: DocEntry[] = (['coverletter', 'claude', 'resume', 'portfolio', 'coverletter'] as const).map((type, i) => ({
  ...base,
  id: `sample-doc-${i}`,
  type,
  title: '샘플 문서 제목',
  content: '샘플 내용입니다. 실제 내용은 주인장만 볼 수 있어요.',
  jobId: '',
  date: day(-i),
  includeInContext: true,
}))

const SAMPLE_TODOS: Todo[] = [3, 5, 8, 12].map((n, i) => ({ ...base, id: `sample-todo-${i}`, text: '샘플 할 일', done: false, due: day(n) }))

export const SAMPLE: Record<Exclude<CollectionName, 'study'>, Entity[]> = {
  jobs: SAMPLE_JOBS,
  docs: SAMPLE_DOCS,
  todos: SAMPLE_TODOS,
}
