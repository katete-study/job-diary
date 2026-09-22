import { useRef, useState } from 'react'
import { PageHead, PrivateGate } from '../components/ui'
import { useAuth } from '../lib/auth'
import { hasFirebase, OWNER_GITHUB_ID } from '../lib/firebase'
import { importAll, saveItem, useCollection } from '../lib/store'
import type { CollectionName, DocEntry, Entity, Job, StudyEntry, Todo } from '../lib/types'
import { downloadText, toDateStr, uid } from '../lib/util'

/** 로컬 데모 모드에서 화면을 확인하기 위한 샘플 데이터 */
async function seedDemo() {
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return toDateStr(d)
  }
  const jobs: Omit<Job, 'createdAt' | 'updatedAt'>[] = [
    { id: uid(), url: 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1', source: 'saramin', company: '당근', title: 'Android 개발자', deadline: day(2), interviewAt: '', eventDate: '', status: 'planned', applied: false, favorite: true, note: 'Compose 경험 우대' },
    { id: uid(), url: 'https://www.jobkorea.co.kr/Recruit/GI_Read/1', source: 'jobkorea', company: '토스', title: 'Android Developer', deadline: day(9), interviewAt: '', eventDate: '', status: 'submitted', applied: true, favorite: false, note: '' },
    { id: uid(), url: '', source: 'other', company: '네이버', title: 'Android 신입 공채', deadline: day(-3), interviewAt: day(5), eventDate: '', status: 'interview', applied: true, favorite: true, note: '코딩테스트 통과' },
  ]
  for (const j of jobs) await saveItem<Job>('jobs', j)
  const study: Omit<StudyEntry, 'createdAt' | 'updatedAt'>[] = [
    { id: uid(), date: day(0), category: 'devstudy', title: 'Compose 상태 호이스팅', content: '## 오늘 배운 것\n- `remember` vs `rememberSaveable`\n- 상태를 **위로** 끌어올리기\n\n```kotlin\nvar count by remember { mutableStateOf(0) }\n```', tags: ['compose', 'android'] },
    { id: uid(), date: day(-1), category: 'study', title: '자료구조: 해시 테이블', content: '충돌 해결: 체이닝, 개방 주소법', tags: ['cs'] },
    { id: uid(), date: day(-2), category: 'project', title: 'katete-study 스터디 정리', content: 'Spring 입문 실습 복습', tags: ['spring'] },
    { id: uid(), date: day(-4), category: 'stack', title: 'Kotlin Coroutines 정리', content: 'Flow / StateFlow 차이', tags: ['kotlin'] },
  ]
  for (const s of study) await saveItem<StudyEntry>('study', s)
  const docs: Omit<DocEntry, 'createdAt' | 'updatedAt'>[] = [
    { id: uid(), type: 'claude', title: 'LinkU - 로그인/세션 설계', content: '## 상황\n토큰 만료 시 화면이 튕기는 문제\n\n## 내가 한 일\n- 401 응답 시 재발급 후 재시도\n\n## 결과\n로그아웃 이탈 감소', jobId: '', date: day(-1), includeInContext: true },
    { id: uid(), type: 'coverletter', title: '당근 지원 자소서 초안', content: '## 지원 동기\n동네 기반 서비스에 관심이 많아…', jobId: jobs[0].id, date: day(0), includeInContext: true },
  ]
  for (const d of docs) await saveItem<DocEntry>('docs', d)
  await saveItem<Todo>('todos', { id: uid(), text: '토스 코딩테스트 대비', done: false, due: day(3), category: 'apply' })
  await saveItem<Todo>('todos', { id: uid(), text: '포트폴리오 README 정리', done: true, due: '', category: 'life' })
}

function SettingsInner() {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')
  const study = useCollection<StudyEntry>('study').items
  const jobs = useCollection<Job>('jobs').items
  const docs = useCollection<DocEntry>('docs').items
  const todos = useCollection<Todo>('todos').items

  const backup = () => {
    const data: Record<CollectionName, Entity[]> = { study, jobs, docs, todos }
    downloadText(`job-diary-backup-${toDateStr(new Date())}.json`, JSON.stringify({ version: 1, ...data }, null, 2), 'application/json')
  }

  return (
    <div className="stack">
      <PageHead icon="settings" title="설정 · 백업" sub="계정 확인, 데이터 백업과 복원" />

      <section className="card">
        <h2>계정</h2>
        <p>
          {user?.name} · 소유자 GitHub ID <code>{OWNER_GITHUB_ID}</code> (KateteDeveloper)
        </p>
        <p className="muted">모드: {hasFirebase ? 'Firebase (Firestore 규칙으로 서버에서 접근 제어)' : '로컬 데모 (이 브라우저의 localStorage)'}</p>
      </section>

      <section className="card">
        <h2>백업 / 복원</h2>
        <p className="muted">공부 {study.length} · 공고 {jobs.length} · 문서 {docs.length} · 할 일 {todos.length}개를 JSON 한 파일로 내려받거나 복원해요.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={backup}>
            백업 내려받기
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            백업 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const r = await importAll(JSON.parse(await file.text()))
                const parts = Object.entries(r.saved).map(([k, n]) => `${k} ${n}`).join(' · ')
                setImportMsg(r.failed ? `⚠️ 저장 ${parts} / 실패 ${r.failed}건 (${r.firstError})` : `✅ 저장 완료: ${parts}`)
              } catch {
                setImportMsg('⚠️ 올바른 백업 파일이 아니에요.')
              }
              e.target.value = ''
            }}
          />
        </div>
        {importMsg && <p>{importMsg}</p>}
      </section>

      {!hasFirebase && (
        <section className="card">
          <h2>🧪 데모 데이터</h2>
          <p className="muted">화면 구성을 확인할 수 있게 샘플 공고/공부 기록/문서를 채워요.</p>
          <button className="btn" onClick={() => seedDemo()}>
            샘플 데이터 채우기
          </button>
        </section>
      )}
    </div>
  )
}

export default function Settings() {
  return (
    <PrivateGate>
      <SettingsInner />
    </PrivateGate>
  )
}
