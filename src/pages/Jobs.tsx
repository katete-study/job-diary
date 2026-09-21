import { useState } from 'react'
import { CopyButton, Empty, Icon, Modal, PrivateGate } from '../components/ui'
import { useCollection, useCrud } from '../lib/store'
import type { DocEntry, Job, JobStatus } from '../lib/types'
import { buildJobPrompt, daysLeft, ddayLabel, detectSource, DOC_LABEL, SOURCE_LABEL, STATUS_LABEL, uid } from '../lib/util'

type Draft = Omit<Job, 'createdAt' | 'updatedAt'>
type Filter = 'all' | 'todo' | 'applied' | 'favorite'

const STATUSES = Object.keys(STATUS_LABEL) as JobStatus[]

function blank(): Draft {
  return { id: uid(), url: '', source: 'other', company: '', title: '', deadline: '', interviewAt: '', status: 'watching', applied: false, favorite: false, note: '' }
}

function JobsInner() {
  const { items: jobs, ready } = useCollection<Job>('jobs')
  const { items: docs } = useCollection<DocEntry>('docs')
  const { save, remove } = useCrud<Job>('jobs')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)

  const shown = jobs
    .filter((j) => {
      if (filter === 'todo') return !j.applied
      if (filter === 'applied') return j.applied
      if (filter === 'favorite') return j.favorite
      return true
    })
    .filter((j) => `${j.company} ${j.title} ${j.note}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      // 마감 임박 순, 마감 없는 공고는 뒤로
      const da = a.deadline || '9999-99-99'
      const db = b.deadline || '9999-99-99'
      return da.localeCompare(db) || b.updatedAt - a.updatedAt
    })

  const patch = (j: Job, p: Partial<Job>) => save({ ...j, ...p })
  const filters: [Filter, string, number][] = [
    ['all', '전체', jobs.length],
    ['todo', '미지원', jobs.filter((j) => !j.applied).length],
    ['applied', '지원 완료', jobs.filter((j) => j.applied).length],
    ['favorite', '찜', jobs.filter((j) => j.favorite).length],
  ]

  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>
          <Icon name="jobs" size={40} /> 채용공고
        </h1>
        <button className="btn primary" onClick={() => setEditing(blank())}>
          + 공고 추가
        </button>
      </div>

      <div className="row wrap">
        <div className="chips">
          {filters.map(([k, label, n]) => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
              {k === 'favorite' && <Icon name="bookmark" size={18} />} {label} {n}
            </button>
          ))}
        </div>
        <input className="search" placeholder="🔍 회사/공고/메모 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {!ready ? (
        <Empty>불러오는 중…</Empty>
      ) : shown.length === 0 ? (
        <Empty icon="search">{jobs.length === 0 ? '사람인/잡코리아 공고 URL을 붙여 넣어 첫 공고를 추가해 보세요!' : '조건에 맞는 공고가 없어요.'}</Empty>
      ) : (
        <div className="grid cards">
          {shown.map((j) => {
            const left = daysLeft(j.deadline)
            const closed = left !== null && left < 0
            return (
              <article key={j.id} className={`card job ${j.applied ? 'applied' : ''} ${closed ? 'closed' : ''}`}>
                <div className="row">
                  <span className="badge">{SOURCE_LABEL[j.source]}</span>
                  <span className={`dday ${left !== null && left >= 0 && left <= 2 ? 'hot' : ''}`}>{closed ? '마감' : ddayLabel(j.deadline)}</span>
                  <button className={`fav push ${j.favorite ? 'on' : ''}`} onClick={() => patch(j, { favorite: !j.favorite })} title="찜" aria-pressed={j.favorite}>
                    <Icon name="bookmark" size={26} />
                  </button>
                </div>
                <h3>{j.company || '(회사 미입력)'}</h3>
                <p>{j.title}</p>
                {j.deadline && <p className="muted small">마감 {j.deadline}</p>}

                <div className="row between">
                  <label className="switch" title="지원했는지 on/off">
                    <input type="checkbox" checked={j.applied} onChange={(e) => patch(j, { applied: e.target.checked, status: e.target.checked && j.status === 'watching' ? 'document' : j.status })} />
                    <span className="slider" />
                    <em>{j.applied ? '지원 완료' : '미지원'}</em>
                  </label>
                  <select value={j.status} onChange={(e) => patch(j, { status: e.target.value as JobStatus })} aria-label="진행 상태">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row wrap">
                  {j.url && (
                    <a className="btn" href={j.url} target="_blank" rel="noreferrer">
                      공고 열기 ↗
                    </a>
                  )}
                  <button className="btn" onClick={() => setEditing(j)}>
                    수정
                  </button>
                  <CopyButton label="Claude 프롬프트" text={() => buildJobPrompt(j, docs)} />
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal title={jobs.some((j) => j.id === editing.id) ? '공고 수정' : '새 공고'} onClose={() => setEditing(null)} wide>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault()
              await save(editing)
              setEditing(null)
            }}
          >
            <label>
              공고 URL (사람인 · 잡코리아 · 원티드 …)
              <input
                type="url"
                value={editing.url}
                placeholder="https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=..."
                onChange={(e) => setEditing({ ...editing, url: e.target.value, source: detectSource(e.target.value) })}
              />
              <small className="muted">사이트는 URL로 자동 인식해요. 회사/공고명은 직접 입력해 주세요.</small>
            </label>
            <div className="form-row">
              <label>
                회사
                <input value={editing.company} onChange={(e) => setEditing({ ...editing, company: e.target.value })} required />
              </label>
              <label>
                공고 제목 / 직무
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Android 개발자 (신입/경력)" />
              </label>
            </div>
            <div className="form-row">
              <label>
                마감일
                <input type="date" value={editing.deadline} onChange={(e) => setEditing({ ...editing, deadline: e.target.value })} />
              </label>
              <label>
                면접일
                <input type="date" value={editing.interviewAt} onChange={(e) => setEditing({ ...editing, interviewAt: e.target.value })} />
              </label>
              <label>
                진행 상태
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as JobStatus })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={editing.applied} onChange={(e) => setEditing({ ...editing, applied: e.target.checked })} /> 지원했어요
            </label>
            <label>
              메모 (자격요건, 우대사항, 궁금한 점)
              <textarea rows={5} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </label>

            {docs.some((d) => d.jobId === editing.id) && (
              <div>
                <b>이 공고에 연결된 문서</b>
                <ul className="list">
                  {docs
                    .filter((d) => d.jobId === editing.id)
                    .map((d) => (
                      <li key={d.id}>
                        <span className="badge">{DOC_LABEL[d.type]}</span> {d.title}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="row between">
              {jobs.some((j) => j.id === editing.id) ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={async () => {
                    if (confirm('이 공고를 삭제할까요?')) {
                      await remove(editing.id)
                      setEditing(null)
                    }
                  }}
                >
                  삭제
                </button>
              ) : (
                <span />
              )}
              <div className="row">
                <button type="button" className="btn" onClick={() => setEditing(null)}>
                  취소
                </button>
                <button className="btn primary">저장</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default function Jobs() {
  return (
    <PrivateGate>
      <JobsInner />
    </PrivateGate>
  )
}
