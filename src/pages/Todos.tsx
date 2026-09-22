import { useState, type DragEvent } from 'react'
import { Empty, Modal, PageHead, PrivateGate } from '../components/ui'
import { useCollection, useCrud } from '../lib/store'
import type { Job, Todo, TodoCategory } from '../lib/types'
import { ddayLabel, extractUrl, toDateStr, today, TODO_CATEGORY_LABEL, TODO_CATEGORY_TONE, uid } from '../lib/util'

type View = 'week' | 'day' | 'list'

const VIEW_KEY = 'jd:todo-view'
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const VIEW_LABEL: Record<View, string> = { week: '주간', day: '일간', list: '목록' }
const CATEGORIES = Object.keys(TODO_CATEGORY_LABEL) as TodoCategory[]
/** 카테고리 뱃지를 누르면 이 순서로 돌아간다 */
const nextCategory = (c: TodoCategory): TodoCategory => CATEGORIES[(CATEGORIES.indexOf(c) + 1) % CATEGORIES.length]

const fromStr = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** YYYY-MM-DD 날짜에 n일을 더한다 */
const shift = (s: string, n: number) => {
  const d = fromStr(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** 일요일 시작 기준, 해당 날짜가 속한 주의 7일 */
const weekOf = (s: string) => {
  const start = shift(s, -fromStr(s).getDay())
  return Array.from({ length: 7 }, (_, i) => shift(start, i))
}

const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8))}`

interface JobEvent {
  kind: 'deadline' | 'interview' | 'event'
  label: string
}

/** 그날의 공고 일정(마감·면접·접수/통보) */
function jobEventsOn(jobs: Job[], date: string): JobEvent[] {
  const out: JobEvent[] = []
  jobs.forEach((j) => {
    if (j.deadline === date) out.push({ kind: 'deadline', label: `${j.company} 마감${j.applied ? ' ✓' : ''}` })
    if (j.interviewAt === date) out.push({ kind: 'interview', label: `${j.company} 면접` })
    if (j.eventDate === date) out.push({ kind: 'event', label: `${j.company} ${j.status === 'rejected' ? '결과 통보' : '접수'}` })
  })
  return out
}

const EVENT_CLASS: Record<JobEvent['kind'], string> = { deadline: 'ev-deadline', interview: 'ev-interview', event: 'ev-event' }

/** 링크 표시용으로 도메인만 짧게 뽑는다. 잘못된 URL이면 원문을 그대로 돌려준다. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

interface RowProps {
  todo: Todo
  showDue?: boolean
  onToggle: (t: Todo) => void
  onRemove: (id: string) => void
  onCycleCategory: (t: Todo) => void
  onEditUrl: (t: Todo) => void
}

/** 체크박스 + 텍스트 한 줄. 끌어서 다른 날짜/영역으로 옮길 수 있다. 분류 뱃지를 누르면 다음 분류로 바뀐다. */
function TodoRow({ todo, showDue = false, onToggle, onRemove, onCycleCategory, onEditUrl }: RowProps) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', todo.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  return (
    <div className={`trow ${todo.done ? 'done' : ''}`} draggable onDragStart={onDragStart}>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo)} aria-label={`${todo.text} 완료`} />
      <button
        type="button"
        className={`pill ${TODO_CATEGORY_TONE[todo.category]} tcat`}
        onClick={() => onCycleCategory(todo)}
        title="눌러서 분류 바꾸기"
      >
        {TODO_CATEGORY_LABEL[todo.category]}
      </button>
      <span className="ttext">
        {todo.text}
        {todo.url && (
          <a className="tlink" href={todo.url} target="_blank" rel="noopener noreferrer" title={todo.url} onClick={(e) => e.stopPropagation()}>
            🔗 {hostOf(todo.url)}
          </a>
        )}
      </span>
      {showDue && todo.due && <span className="dday">{ddayLabel(todo.due)}</span>}
      <button
        className="turl"
        onClick={() => onEditUrl(todo)}
        aria-label={todo.url ? '링크 수정' : '링크 추가'}
        title={todo.url ? '링크 수정/삭제' : '링크 추가'}
      >
        {todo.url ? '🔗' : '+🔗'}
      </button>
      <button className="tdel" onClick={() => onRemove(todo.id)} aria-label="삭제" title="삭제">
        ✕
      </button>
    </div>
  )
}

/** 한 줄 입력 후 Enter로 추가 */
function QuickAdd({ placeholder = '+ 할 일 추가', onAdd }: { placeholder?: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <input
      className="quick"
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && text.trim()) {
          onAdd(text.trim())
          setText('')
        }
      }}
    />
  )
}

function TodosInner() {
  const { items, ready } = useCollection<Todo>('todos')
  const { items: jobs } = useCollection<Job>('jobs')
  const { save, remove } = useCrud<Todo>('todos')
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || 'week'
    } catch {
      return 'week'
    }
  })
  const [cursor, setCursor] = useState(today())
  const [over, setOver] = useState('')
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [category, setCategory] = useState<TodoCategory>('study')
  const [filterCat, setFilterCat] = useState<TodoCategory | 'all'>('all')
  const [bulk, setBulk] = useState<{ date: string; category: TodoCategory; text: string } | null>(null)

  const t0 = today()
  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* 저장 실패는 무시 */
    }
  }

  /** label 에 URL이 섞여 있으면(붙여넣기) 자동으로 분리해서 저장한다 */
  const add = (label: string, date: string, cat: TodoCategory = 'study') => {
    const { text: parsedText, url } = extractUrl(label)
    save({ id: uid(), text: parsedText, done: false, due: date, category: cat, url })
  }
  const toggle = (t: Todo) => save({ ...t, done: !t.done })
  const cycleCategory = (t: Todo) => save({ ...t, category: nextCategory(t.category) })
  /** 링크를 새로 넣거나 바꾼다. 빈 값으로 확인하면 링크를 지운다 */
  const editUrl = (t: Todo) => {
    const next = window.prompt('링크(URL) — 지우려면 비우고 확인을 누르세요', t.url)
    if (next === null) return
    save({ ...t, url: next.trim() })
  }

  /** 붙여넣은 여러 줄을 한 줄씩 같은 날짜/분류의 할 일로 만든다 (오늘 풀 문제 8개처럼 한 번에 등록할 때) */
  const addBulk = () => {
    if (!bulk) return
    const lines = bulk.text.split('\n').map((l) => l.trim()).filter(Boolean)
    lines.forEach((line) => add(line, bulk.date, bulk.category))
    setBulk(null)
  }
  const todosOn = (date: string) => items.filter((t) => t.due === date).sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt)
  const undated = items.filter((t) => !t.due && !t.done)
  const overdue = items.filter((t) => t.due && t.due < t0 && !t.done).sort((a, b) => a.due.localeCompare(b.due))

  /** 끌어온 할 일의 기한을 해당 날짜로 바꾼다 ('' 이면 기한 없음) */
  const dropOn = (e: DragEvent, date: string) => {
    e.preventDefault()
    setOver('')
    const id = e.dataTransfer.getData('text/plain')
    const t = items.find((x) => x.id === id)
    if (t && t.due !== date) save({ ...t, due: date })
  }
  const dropProps = (key: string, date: string) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setOver(key)
    },
    onDragLeave: () => setOver(''),
    onDrop: (e: DragEvent) => dropOn(e, date),
  })

  const days = weekOf(cursor)
  const move = (dir: number) => setCursor(shift(cursor, dir * (view === 'day' ? 1 : 7)))
  const rangeLabel = view === 'day' ? `${cursor} (${WEEKDAYS[fromStr(cursor).getDay()]})` : `${md(days[0])} – ${md(days[6])}`

  const row = (t: Todo, showDue = false) => (
    <TodoRow key={t.id} todo={t} showDue={showDue} onToggle={toggle} onRemove={remove} onCycleCategory={cycleCategory} onEditUrl={editUrl} />
  )

  const backlog = (
    <div className="backlog">
      <div className={`card backlog-card ${over === 'overdue' ? 'over' : ''}`}>
        <h2>⏰ 지난 미완료 {overdue.length}</h2>
        {overdue.length === 0 ? <p className="muted small">놓친 할 일이 없어요 👍</p> : overdue.map((t) => row(t, true))}
      </div>
      <div className={`card backlog-card ${over === 'undated' ? 'over' : ''}`} {...dropProps('undated', '')}>
        <h2>📌 기한 없음 {undated.length}</h2>
        {undated.length === 0 ? <p className="muted small">여기로 끌어다 놓으면 기한이 없어져요</p> : undated.map((t) => row(t))}
        <QuickAdd placeholder="+ 기한 없는 할 일" onAdd={(label) => add(label, '')} />
      </div>
    </div>
  )

  return (
    <div className="stack">
      <PageHead icon="todo" title="할 일" sub="시험 · 자소서 · 지원 준비 · 마감 일정을 한눈에">
        <div className="seg" role="tablist" aria-label="보기 방식">
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => changeView(v)} role="tab" aria-selected={view === v}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        {view !== 'list' && (
          <>
            <button className="btn" onClick={() => move(-1)} aria-label="이전">
              ◀
            </button>
            <b className="month">{rangeLabel}</b>
            <button className="btn" onClick={() => move(1)} aria-label="다음">
              ▶
            </button>
            <button className="btn" onClick={() => setCursor(t0)}>
              오늘
            </button>
          </>
        )}
        <button className="btn primary" onClick={() => setBulk({ date: view === 'list' ? t0 : cursor, category: 'study', text: '' })}>
          + 여러 개 한번에
        </button>
      </PageHead>

      {!ready ? (
        <Empty>불러오는 중…</Empty>
      ) : view === 'week' ? (
        <>
          <div className="week-wrap">
            <div className="week">
              {days.map((d, i) => {
                const evs = jobEventsOn(jobs, d)
                return (
                  <div key={d} className={`daycol ${d === t0 ? 'today' : ''} ${over === d ? 'over' : ''}`} {...dropProps(d, d)}>
                    <button className="daycol-head" onClick={() => { setCursor(d); changeView('day') }} title="일간 보기">
                      <span className={i === 0 ? 'sun' : ''}>{WEEKDAYS[i]}</span>
                      <b>{Number(d.slice(8))}</b>
                    </button>
                    {evs.map((e, k) => (
                      <span key={k} className={`ev ${EVENT_CLASS[e.kind]}`}>
                        {e.label}
                      </span>
                    ))}
                    {todosOn(d).map((t) => row(t))}
                    <QuickAdd placeholder="+ 추가" onAdd={(label) => add(label, d)} />
                  </div>
                )
              })}
            </div>
          </div>
          {backlog}
        </>
      ) : view === 'day' ? (
        <>
          <div className="strip">
            {days.map((d, i) => (
              <button key={d} className={`${d === cursor ? 'on' : ''} ${d === t0 ? 'today' : ''}`} onClick={() => setCursor(d)}>
                <span className={i === 0 ? 'sun' : ''}>{WEEKDAYS[i]}</span>
                <b>{Number(d.slice(8))}</b>
                <small>{todosOn(d).filter((t) => !t.done).length + jobEventsOn(jobs, d).length || ''}</small>
              </button>
            ))}
          </div>
          <div className={`card daybig ${over === cursor ? 'over' : ''}`} {...dropProps(cursor, cursor)}>
            <h2>
              {cursor} ({WEEKDAYS[fromStr(cursor).getDay()]}) {cursor === t0 && <span className="badge">오늘</span>}
            </h2>
            {jobEventsOn(jobs, cursor).length > 0 && (
              <div className="evlist">
                {jobEventsOn(jobs, cursor).map((e, k) => (
                  <span key={k} className={`ev ${EVENT_CLASS[e.kind]}`}>
                    {e.label}
                  </span>
                ))}
              </div>
            )}
            {todosOn(cursor).length === 0 ? <p className="muted">이 날 할 일이 없어요.</p> : todosOn(cursor).map((t) => row(t))}
            <QuickAdd onAdd={(label) => add(label, cursor)} />
          </div>
          {backlog}
        </>
      ) : (
        <>
          <form
            className="card row wrap"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!text.trim()) return
              await add(text.trim(), due, category)
              setText('')
              setDue('')
            }}
          >
            <input className="grow" placeholder="예: 카카오 코딩테스트 풀어보기" value={text} onChange={(e) => setText(e.target.value)} />
            <select value={category} onChange={(e) => setCategory(e.target.value as TodoCategory)} aria-label="분류">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TODO_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="기한" />
            <button className="btn primary">추가</button>
          </form>

          <div className="chips">
            <button className={`chip ${filterCat === 'all' ? 'on' : ''}`} onClick={() => setFilterCat('all')}>
              전체 {items.length}
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} className={`chip ${filterCat === c ? 'on' : ''}`} onClick={() => setFilterCat(c)}>
                {TODO_CATEGORY_LABEL[c]} {items.filter((t) => t.category === c).length}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <Empty icon="fighting">할 일이 없어요. 오늘도 화이팅!</Empty>
          ) : (
            <div className="card tlist">
              {[...items]
                .filter((t) => filterCat === 'all' || t.category === filterCat)
                .sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt - b.createdAt)
                .map((t) => row(t, true))}
            </div>
          )}
        </>
      )}

      {bulk && (
        <Modal title="여러 개 한번에 추가" onClose={() => setBulk(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              addBulk()
            }}
          >
            <p className="muted small">
              오늘 풀 문제 목록처럼 한 줄에 하나씩 붙여넣으면 전부 같은 날짜·분류의 할 일로 등록돼요. 줄 끝에 링크를 같이 붙여넣으면 자동으로 분리돼요.
            </p>
            <div className="form-row">
              <label>
                날짜
                <input type="date" value={bulk.date} onChange={(e) => setBulk({ ...bulk, date: e.target.value })} />
              </label>
              <label>
                분류
                <select value={bulk.category} onChange={(e) => setBulk({ ...bulk, category: e.target.value as TodoCategory })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {TODO_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              할 일 목록 (한 줄에 하나)
              <textarea
                rows={10}
                autoFocus
                value={bulk.text}
                onChange={(e) => setBulk({ ...bulk, text: e.target.value })}
                placeholder={'예)\n평균 구하기 https://school.programmers.co.kr/learn/courses/30/lessons/12944\n자릿수 더하기\n폰켓몬'}
              />
            </label>
            <div className="row end">
              <button type="button" className="btn" onClick={() => setBulk(null)}>
                취소
              </button>
              <button className="btn primary">
                {bulk.text.split('\n').filter((l) => l.trim()).length}개 추가
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default function Todos() {
  return (
    <PrivateGate>
      <TodosInner />
    </PrivateGate>
  )
}
