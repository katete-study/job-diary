import { useState, type DragEvent } from 'react'
import { Empty, Modal, PageHead, PrivateGate } from '../components/ui'
import { useCollection, useCrud } from '../lib/store'
import type { Job, StudyEntry, Todo, TodoCategory } from '../lib/types'
import { ddayLabel, extractUrl, parseBulkTodos, toDateStr, today, TODO_CATEGORY_LABEL, TODO_CATEGORY_TONE, uid } from '../lib/util'

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

interface RowProps {
  todo: Todo
  showDue?: boolean
  /** 주간/일간처럼 폭이 좁은 곳에서는 분류를 글자 대신 점으로 줄여서 제목이 보일 공간을 늘린다 */
  compact?: boolean
  onToggle: (t: Todo) => void
  onRemove: (id: string) => void
  onCycleCategory: (t: Todo) => void
  onOpenDetail: (t: Todo) => void
}

/**
 * 체크박스 + 한 줄 제목. 끌어서 다른 날짜/영역으로 옮길 수 있다.
 * 분류 뱃지를 누르면 다음 분류로 바뀌고, 제목을 누르면 상세(수정) 창이 뜬다.
 * 링크가 있어도 줄이 늘어나지 않도록 항상 한 줄로 잘라서 보여준다.
 */
function TodoRow({ todo, showDue = false, compact = false, onToggle, onRemove, onCycleCategory, onOpenDetail }: RowProps) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', todo.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const catLabel = TODO_CATEGORY_LABEL[todo.category]
  const catTone = TODO_CATEGORY_TONE[todo.category]
  return (
    <div className={`trow ${todo.done ? 'done' : ''}`} draggable onDragStart={onDragStart}>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo)} aria-label={`${todo.text} 완료`} />
      <button
        type="button"
        className={compact ? `tdot ${catTone}` : `pill ${catTone} tcat`}
        onClick={() => onCycleCategory(todo)}
        aria-label={`분류: ${catLabel} (눌러서 바꾸기)`}
        title={`${catLabel} · 눌러서 분류 바꾸기`}
      >
        {compact ? '' : catLabel}
      </button>
      <button
        type="button"
        className="ttext-btn"
        onClick={() => onOpenDetail(todo)}
        title={[todo.text, todo.note, todo.url].filter(Boolean).join('\n')}
      >
        <span className="ttext">{todo.text}</span>
        {todo.note && <span className="tlinkdot">📝</span>}
        {todo.url && <span className="tlinkdot">🔗</span>}
      </button>
      {showDue && todo.due && <span className="dday">{ddayLabel(todo.due)}</span>}
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

const DUE_CHIP_LABELS = ['오늘', '내일', '모레', '3일 후', '4일 후', '5일 후', '6일 후', '7일 후']

/**
 * 할 일 기한을 "오늘 ~ 7일 후" 중에서만 고르게 하는 칩. 계획형이 아니라 먼 미래 날짜를 잡아두고
 * 잊어버리는 걸 막기 위해, 달력 대신 이 범위로만 고르게 제한한다.
 */
function DueChips({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const t0 = today()
  return (
    <div className="chips">
      <button type="button" className={`chip ${value === '' ? 'on' : ''}`} onClick={() => onChange('')}>
        기한 없음
      </button>
      {DUE_CHIP_LABELS.map((label, i) => {
        const d = shift(t0, i)
        return (
          <button key={d} type="button" className={`chip ${value === d ? 'on' : ''}`} onClick={() => onChange(d)}>
            {label} ({md(d)})
          </button>
        )
      })}
    </div>
  )
}

function TodosInner() {
  const { items, ready } = useCollection<Todo>('todos')
  const { items: jobs } = useCollection<Job>('jobs')
  const { items: studyEntries } = useCollection<StudyEntry>('study')
  const { save, remove } = useCrud<Todo>('todos')
  const { save: saveStudy, remove: removeStudy } = useCrud<StudyEntry>('study')
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
  const [detail, setDetail] = useState<Todo | null>(null)

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
    save({ id: uid(), text: parsedText, done: false, due: date, category: cat, url, note: '' })
  }
  /**
   * "공부" 분류 할 일을 완료로 체크하면 공부 기록에 자동으로 기록을 남기고(직접 안 적어도 됨),
   * 체크를 다시 풀면 그 자동 기록을 지운다. 이미 기록이 있으면 중복 생성하지 않는다.
   */
  const syncStudyEntry = (t: Todo, done: boolean) => {
    if (t.category !== 'study') return
    if (done) {
      if (studyEntries.some((s) => s.sourceTodoId === t.id)) return
      const content = [`오늘 **${t.text}** 을(를) 풀었어요.`, t.url ? `\n- 문제 링크: ${t.url}` : '']
        .filter(Boolean)
        .join('\n')
      saveStudy({ id: uid(), date: today(), category: 'study', title: t.text, content, tags: ['자동기록'], sourceTodoId: t.id })
    } else {
      studyEntries.filter((s) => s.sourceTodoId === t.id).forEach((s) => removeStudy(s.id))
    }
  }
  const toggle = (t: Todo) => {
    const done = !t.done
    save({ ...t, done })
    syncStudyEntry(t, done)
  }
  const cycleCategory = (t: Todo) => save({ ...t, category: nextCategory(t.category) })
  /** 할 일을 지울 때, 거기서 자동 생성된 공부 기록이 있으면 같이 지운다 */
  const removeTodo = (id: string) => {
    remove(id)
    studyEntries.filter((s) => s.sourceTodoId === id).forEach((s) => removeStudy(s.id))
  }

  /**
   * 붙여넣은 텍스트를 같은 날짜·분류의 할 일 여러 개로 만든다 (오늘 풀 문제 8개처럼 한 번에 등록할 때).
   * 한 줄짜리 목록이든, AI가 만들어 준 "1번. 제목\n\n* 핵심: ...\n* 링크: ..." 형식이든 알아서 나눈다.
   */
  const addBulk = () => {
    if (!bulk) return
    parseBulkTodos(bulk.text).forEach(({ text, url, note }) =>
      save({ id: uid(), text, done: false, due: bulk.date, category: bulk.category, url, note }),
    )
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

  const row = (t: Todo, showDue = false, compact = true) => (
    <TodoRow
      key={t.id}
      todo={t}
      showDue={showDue}
      compact={compact}
      onToggle={toggle}
      onRemove={removeTodo}
      onCycleCategory={cycleCategory}
      onOpenDetail={setDetail}
    />
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
            <div className="row wrap grow">
              <input className="grow" placeholder="예: 카카오 코딩테스트 풀어보기" value={text} onChange={(e) => setText(e.target.value)} />
              <select value={category} onChange={(e) => setCategory(e.target.value as TodoCategory)} aria-label="분류">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TODO_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <button className="btn primary">추가</button>
            </div>
            <DueChips value={due} onChange={setDue} />
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
                .map((t) => row(t, true, false))}
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
              한 줄에 하나씩 붙여넣으면 전부 같은 날짜·분류의 할 일로 등록돼요. Gemini/ChatGPT가 "1번. 제목 (Lv.1)" +
              "핵심:" + "링크:" 형식으로 문단을 나눠 줬다면, 문단 사이 빈 줄을 그대로 두고 붙여넣으세요 — 문단 하나가
              할 일 하나로 자동으로 묶이고, 핵심은 메모로, 링크는 링크로 들어가요.
            </p>
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
            <label>
              날짜
              <DueChips value={bulk.date} onChange={(d) => setBulk({ ...bulk, date: d })} />
            </label>
            <label>
              할 일 목록
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
              <button className="btn primary">{parseBulkTodos(bulk.text).length}개 추가</button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title="할 일 상세" onClose={() => setDetail(null)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault()
              const prev = items.find((x) => x.id === detail.id)
              await save(detail)
              if (!prev || prev.done !== detail.done) syncStudyEntry(detail, detail.done)
              setDetail(null)
            }}
          >
            <label>
              제목
              <input value={detail.text} onChange={(e) => setDetail({ ...detail, text: e.target.value })} required autoFocus />
            </label>
            <label>
              분류
              <select value={detail.category} onChange={(e) => setDetail({ ...detail, category: e.target.value as TodoCategory })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TODO_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              기한
              <DueChips value={detail.due} onChange={(d) => setDetail({ ...detail, due: d })} />
            </label>
            <label>
              메모 (핵심 개념·힌트)
              <input
                placeholder="예: HashSet으로 중복 제거"
                value={detail.note}
                onChange={(e) => setDetail({ ...detail, note: e.target.value })}
              />
            </label>
            <label>
              링크 (URL)
              <input
                type="url"
                placeholder="https://school.programmers.co.kr/..."
                value={detail.url}
                onChange={(e) => setDetail({ ...detail, url: e.target.value })}
              />
            </label>
            {detail.url && (
              <a className="btn" href={detail.url} target="_blank" rel="noopener noreferrer">
                🔗 링크 열기
              </a>
            )}
            <label className="row">
              <input type="checkbox" checked={detail.done} onChange={(e) => setDetail({ ...detail, done: e.target.checked })} />
              완료
            </label>
            <div className="row end">
              <button
                type="button"
                className="btn danger"
                onClick={async () => {
                  if (confirm('이 할 일을 삭제할까요?')) {
                    removeTodo(detail.id)
                    setDetail(null)
                  }
                }}
              >
                삭제
              </button>
              <button type="button" className="btn" onClick={() => setDetail(null)}>
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

export default function Todos() {
  return (
    <PrivateGate>
      <TodosInner />
    </PrivateGate>
  )
}
