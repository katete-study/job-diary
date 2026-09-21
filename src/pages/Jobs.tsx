import { useState } from 'react'
import { CopyButton, Empty, Icon, Modal, PageHead, Pill, PrivateGate } from '../components/ui'
import { useCollection, useCrud } from '../lib/store'
import type { DocEntry, Job, JobStatus } from '../lib/types'
import { buildJobPrompt, daysLeft, ddayLabel, detectSource, DOC_LABEL, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, uid } from '../lib/util'

type Draft = Omit<Job, 'createdAt' | 'updatedAt'>
type Filter = 'all' | 'todo' | 'applied' | 'favorite'

const STATUSES = Object.keys(STATUS_LABEL) as JobStatus[]

function blank(): Draft {
  return { id: uid(), url: '', source: 'other', company: '', title: '', deadline: '', interviewAt: '', eventDate: '', status: 'considering', applied: false, favorite: false, note: '' }
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
      // 마감이 안 지난 공고를 임박한 순으로 먼저, 마감 없음/지난 공고는 뒤로
      const live = (j: Job) => (j.deadline && (daysLeft(j.deadline) ?? -1) >= 0 ? 0 : 1)
      return live(a) - live(b) || (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99') || b.updatedAt - a.updatedAt
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
      <PageHead icon="jobs" title="채용공고" sub={`총 ${jobs.length}개 · 지원 완료 ${jobs.filter((j) => j.applied).length}개`}>
        <button className="btn primary" onClick={() => setEditing(blank())}>
          + 공고 추가
        </button>
      </PageHead>

      <div className="card">
        <div className="toolbar">
          <div className="chips">
            {filters.map(([k, label, n]) => (
              <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
                {label} <em>{n}</em>
              </button>
            ))}
          </div>
          <input className="search" placeholder="🔍 회사 · 직무 · 메모 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {!ready ? (
          <Empty>불러오는 중…</Empty>
        ) : shown.length === 0 ? (
          <Empty icon="search">{jobs.length === 0 ? '사람인/잡코리아 공고 URL을 붙여 넣어 첫 공고를 추가해 보세요!' : '조건에 맞는 공고가 없어요.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>회사</th>
                  <th>직무</th>
                  <th>상태</th>
                  <th>지원</th>
                  <th>마감</th>
                  <th>접수·통보</th>
                  <th>메모</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((j) => {
                  const left = daysLeft(j.deadline)
                  const closed = left !== null && left < 0
                  return (
                    <tr key={j.id} className={j.applied ? 'applied' : ''}>
                      <td>
                        <span className="co">
                          <i className="logo">{(j.company || '?').slice(0, 1)}</i>
                          <span>
                            <b>{j.company || '(회사 미입력)'}</b>
                            <small className="muted">{SOURCE_LABEL[j.source]}</small>
                          </span>
                        </span>
                      </td>
                      <td className="cell-title">{j.title}</td>
                      <td>
                        <select className={`pill-select ${STATUS_TONE[j.status]}`} value={j.status} onChange={(e) => patch(j, { status: e.target.value as JobStatus })} aria-label="진행 상태">
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="switch" title="지원했는지 on/off">
                          <input type="checkbox" checked={j.applied} onChange={(e) => patch(j, { applied: e.target.checked, status: e.target.checked && ['considering', 'planned', 'writing'].includes(j.status) ? 'submitted' : j.status })} />
                          <span className="slider" />
                        </label>
                      </td>
                      <td>
                        {j.deadline ? (
                          <span className="date-cell">
                            {j.deadline.slice(5)}
                            <span className={`dday ${left !== null && left >= 0 && left <= 2 ? 'hot' : ''}`}>{closed ? '마감' : ddayLabel(j.deadline)}</span>
                          </span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td className="muted">{j.eventDate ? j.eventDate.slice(5) : '-'}</td>
                      <td className="cell-note muted" title={j.note}>
                        {j.note}
                      </td>
                      <td>
                        <span className="row-actions">
                          <button className={`fav ${j.favorite ? 'on' : ''}`} onClick={() => patch(j, { favorite: !j.favorite })} title="찜" aria-pressed={j.favorite}>
                            <Icon name="bookmark" size={22} />
                          </button>
                          {j.url && (
                            <a className="btn ghost sm" href={j.url} target="_blank" rel="noreferrer" title="공고 열기">
                              ↗
                            </a>
                          )}
                          <CopyButton className="btn ghost sm" label="🤖" text={() => buildJobPrompt(j, docs)} />
                          <button className="btn sm" onClick={() => setEditing(j)}>
                            수정
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">🤖 버튼은 그 공고 정보와 내 배경 자료를 합친 Claude 프롬프트를 복사해요.</p>
      </div>

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
                직무
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Android 개발자 (신입)" />
              </label>
            </div>
            <div className="form-row">
              <label>
                마감일
                <input type="date" value={editing.deadline} onChange={(e) => setEditing({ ...editing, deadline: e.target.value })} />
              </label>
              <label>
                접수·결과 통보일
                <input type="date" value={editing.eventDate} onChange={(e) => setEditing({ ...editing, eventDate: e.target.value })} />
              </label>
              <label>
                면접일
                <input type="date" value={editing.interviewAt} onChange={(e) => setEditing({ ...editing, interviewAt: e.target.value })} />
              </label>
            </div>
            <div className="form-row">
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
              <label className="check">
                <input type="checkbox" checked={editing.applied} onChange={(e) => setEditing({ ...editing, applied: e.target.checked })} /> 지원했어요
              </label>
            </div>
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
                        <Pill tone="violet">{DOC_LABEL[d.type]}</Pill> {d.title}
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
