import { useState } from 'react'
import { CopyButton, Empty, Icon, Markdown, Modal, PrivateGate } from '../components/ui'
import { useCollection, useCrud } from '../lib/store'
import type { DocEntry, DocType, Job } from '../lib/types'
import { buildClaudeContext, DOC_ICON, DOC_LABEL, downloadText, today, uid } from '../lib/util'

type Draft = Omit<DocEntry, 'createdAt' | 'updatedAt'>

const TYPES = Object.keys(DOC_LABEL) as DocType[]

const TEMPLATES: Record<DocType, string> = {
  resume: '## 기본 정보\n\n## 학력\n\n## 경력\n\n## 기술 스택\n\n## 프로젝트\n',
  coverletter: '## 지원 동기\n\n## 직무 역량\n\n## 협업 경험\n\n## 입사 후 포부\n',
  portfolio: '## 프로젝트 개요\n- 기간:\n- 역할:\n- 기술: \n\n## 문제와 해결\n\n## 성과\n\n## 배운 점\n',
  claude: '## 상황(Situation)\n\n## 내가 한 일(Action)\n\n## 결과(Result)\n\n## 키워드\n',
}

function blank(type: DocType): Draft {
  return { id: uid(), type, title: '', content: TEMPLATES[type], jobId: '', date: today(), includeInContext: true }
}

function DocsInner() {
  const { items: docs, ready } = useCollection<DocEntry>('docs')
  const { items: jobs } = useCollection<Job>('jobs')
  const { save, remove } = useCrud<DocEntry>('docs')
  const [filter, setFilter] = useState<DocType | 'all'>('all')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [preview, setPreview] = useState(false)
  const [showContext, setShowContext] = useState(false)

  const shown = docs.filter((d) => filter === 'all' || d.type === filter).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)
  const jobName = (id: string) => jobs.find((j) => j.id === id)?.company
  const context = buildClaudeContext(docs)
  const included = docs.filter((d) => d.includeInContext).length

  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>
          <Icon name="resume" size={40} /> 문서 보관함
        </h1>
        <div className="row wrap">
          <button className="btn" onClick={() => setShowContext(true)}>
            <Icon name="dev" size={20} /> Claude 컨텍스트 ({included})
          </button>
          <button className="btn primary" onClick={() => setEditing(blank(filter === 'all' ? 'claude' : filter))}>
            + 문서 추가
          </button>
        </div>
      </div>
      <p className="muted">이력서·자소서·포트폴리오와 “내가 한 일” 노트를 마크다운으로 저장해 두면, 새 공고에 지원할 때 Claude에게 그대로 넘겨 줄 수 있어요.</p>

      <div className="chips">
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          전체 {docs.length}
        </button>
        {TYPES.map((t) => (
          <button key={t} className={`chip ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}>
            <Icon name={DOC_ICON[t]} size={20} /> {DOC_LABEL[t]} {docs.filter((d) => d.type === t).length}
          </button>
        ))}
      </div>

      {!ready ? (
        <Empty>불러오는 중…</Empty>
      ) : shown.length === 0 ? (
        <Empty icon="resume">아직 문서가 없어요. 프로젝트 경험부터 한 편 적어 볼까요?</Empty>
      ) : (
        <div className="grid cards">
          {shown.map((d) => (
            <article
              key={d.id}
              className="card clickable"
              onClick={() => {
                setEditing(d)
                setPreview(true)
              }}
            >
              <div className="row">
                <Icon name={DOC_ICON[d.type]} size={30} chip />
                <span className="badge">{DOC_LABEL[d.type]}</span>
                <span className="muted small push">{d.date}</span>
              </div>
              <h3>{d.title}</h3>
              {d.jobId && jobName(d.jobId) && <p className="muted small">🎯 {jobName(d.jobId)} 지원용</p>}
              <p className="muted clamp">{d.content.replace(/[#*`>\-\[\]]/g, '').slice(0, 120)}</p>
              {!d.includeInContext && <span className="tag">Claude 제외</span>}
            </article>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={docs.some((d) => d.id === editing.id) ? '문서 수정' : '새 문서'} onClose={() => setEditing(null)} wide>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault()
              await save(editing)
              setEditing(null)
            }}
          >
            <div className="form-row">
              <label>
                종류
                <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as DocType })}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DOC_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                날짜
                <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} required />
              </label>
              <label>
                연결할 공고 (선택)
                <select value={editing.jobId} onChange={(e) => setEditing({ ...editing, jobId: e.target.value })}>
                  <option value="">없음 (공통)</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.company} {j.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              제목
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required placeholder="예: LinkU 앱 - 로그인/세션 설계" />
            </label>
            <div className="row between">
              <b>내용 (마크다운)</b>
              <button type="button" className="btn ghost" onClick={() => setPreview(!preview)}>
                {preview ? '✏️ 편집' : '👀 미리보기'}
              </button>
            </div>
            {preview ? <Markdown>{editing.content || '_비어 있어요_'}</Markdown> : <textarea rows={14} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />}
            <label className="check">
              <input type="checkbox" checked={editing.includeInContext} onChange={(e) => setEditing({ ...editing, includeInContext: e.target.checked })} /> Claude 컨텍스트에 포함
            </label>
            <div className="row between">
              {docs.some((d) => d.id === editing.id) ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={async () => {
                    if (confirm('이 문서를 삭제할까요?')) {
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

      {showContext && (
        <Modal title="Claude 컨텍스트 (.md)" onClose={() => setShowContext(false)} wide>
          <p className="muted">“Claude 컨텍스트에 포함”이 체크된 문서 {included}개를 하나의 마크다운으로 합쳤어요. 복사해서 Claude에 붙여 넣거나, .md로 받아 Obsidian/프로젝트 폴더에 넣어 두세요.</p>
          <div className="row">
            <CopyButton className="btn primary" label="전체 복사" text={context} />
            <button className="btn" onClick={() => downloadText('claude-context.md', context)}>
              .md 다운로드
            </button>
          </div>
          <pre className="pre">{context}</pre>
        </Modal>
      )}
    </div>
  )
}

export default function Docs() {
  return (
    <PrivateGate>
      <DocsInner />
    </PrivateGate>
  )
}
