import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Empty, Icon, Markdown, Modal, PageHead } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useCollection, useCrud } from '../lib/store'
import type { StudyCategory, StudyEntry } from '../lib/types'
import { CATEGORY_ICON, CATEGORY_LABEL, today, uid } from '../lib/util'

const CATEGORIES = Object.keys(CATEGORY_LABEL) as StudyCategory[]
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "9월 22일 (월)" 형식의 날짜 그룹 제목. 오늘이면 앞에 "오늘 · "를 붙인다. */
function dateHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const head = `${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`
  return dateStr === today() ? `오늘 · ${head}` : head
}

/** 날짜순으로 이미 정렬된 목록을 날짜별로 묶는다 (Map은 삽입 순서를 유지하므로 순서가 그대로 보존된다) */
function groupByDate(list: StudyEntry[]): [string, StudyEntry[]][] {
  const map = new Map<string, StudyEntry[]>()
  for (const s of list) {
    if (!map.has(s.date)) map.set(s.date, [])
    map.get(s.date)!.push(s)
  }
  return [...map.entries()]
}

function blank(): Omit<StudyEntry, 'createdAt' | 'updatedAt'> {
  return { id: uid(), date: today(), category: 'study', title: '', content: '', tags: [], sourceTodoId: '' }
}

/** 공개 공부 기록. 누구나 읽고, 소유자만 작성/수정/삭제한다. */
export default function Study() {
  const { isOwner } = useAuth()
  const { items, ready } = useCollection<StudyEntry>('study')
  const { save, remove } = useCrud<StudyEntry>('study')
  const [filter, setFilter] = useState<StudyCategory | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ReturnType<typeof blank> | null>(null)
  const location = useLocation()

  useEffect(() => {
    const id = (location.state as { open?: string } | null)?.open
    if (id) setOpenId(id)
  }, [location.state])

  const shown = items
    .filter((s) => filter === 'all' || s.category === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)
  const opened = items.find((s) => s.id === openId)

  return (
    <div className="stack">
      <PageHead icon="study" title="공부 기록" sub="누구나 볼 수 있는 공부 기록이에요">
          {isOwner && (
            <button className="btn primary" onClick={() => setEditing(blank())}>
            + 기록 추가
          </button>
          )}
        </PageHead>

      <div className="chips">
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          전체 {items.length}
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
            <Icon name={CATEGORY_ICON[c]} size={20} /> {CATEGORY_LABEL[c]} {items.filter((s) => s.category === c).length}
          </button>
        ))}
      </div>

      {!ready ? (
        <Empty>불러오는 중…</Empty>
      ) : shown.length === 0 ? (
        <Empty icon="rest">아직 기록이 없어요.</Empty>
      ) : (
        <div className="stack">
          {groupByDate(shown).map(([date, entries]) => (
            <section key={date}>
              <h3 className="day-head">
                {dateHeading(date)} <span className="muted small">· {entries.length}개</span>
              </h3>
              <div className="grid cards">
                {entries.map((s) => (
                  <article key={s.id} className="card clickable" onClick={() => setOpenId(s.id)}>
                    <div className="row">
                      <Icon name={CATEGORY_ICON[s.category]} size={30} chip />
                      <span className="badge">{CATEGORY_LABEL[s.category]}</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p className="muted clamp">{s.content.replace(/[#*`>\-\[\]]/g, '').slice(0, 140)}</p>
                    <div className="tags">
                      {s.tags.map((t) => (
                        <span key={t} className="tag">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {opened && (
        <Modal title={opened.title} onClose={() => setOpenId(null)} wide>
          <div className="row wrap">
            <span className="badge">{CATEGORY_LABEL[opened.category]}</span>
            <span className="muted small">{opened.date}</span>
          </div>
          <Markdown>{opened.content || '_내용이 없어요_'}</Markdown>
          {isOwner && (
            <div className="row end">
              <button
                className="btn danger"
                onClick={async () => {
                  if (confirm('이 기록을 삭제할까요?')) {
                    await remove(opened.id)
                    setOpenId(null)
                  }
                }}
              >
                삭제
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setEditing(opened)
                  setOpenId(null)
                }}
              >
                수정
              </button>
            </div>
          )}
        </Modal>
      )}

      {editing && isOwner && (
        <Modal title={items.some((s) => s.id === editing.id) ? '기록 수정' : '새 공부 기록'} onClose={() => setEditing(null)} wide>
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
                날짜
                <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} required />
              </label>
              <label>
                분류
                <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as StudyCategory })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              제목
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required placeholder="예: Compose 상태 호이스팅 정리" />
            </label>
            <label>
              태그 (쉼표로 구분)
              <input
                value={editing.tags.join(', ')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="kotlin, compose"
              />
            </label>
            <label>
              내용 (마크다운)
              <textarea rows={12} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
            </label>
            <div className="row end">
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                취소
              </button>
              <button className="btn primary">저장</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
