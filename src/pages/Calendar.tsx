import { useMemo, useState } from 'react'
import { PageHead, PrivateGate } from '../components/ui'
import { useCollection } from '../lib/store'
import type { Job, Todo } from '../lib/types'
import { toDateStr, today } from '../lib/util'

interface CalEvent {
  kind: 'deadline' | 'interview' | 'event' | 'todo'
  label: string
  done?: boolean
}

const KIND_STYLE: Record<CalEvent['kind'], string> = { deadline: 'ev-deadline', interview: 'ev-interview', event: 'ev-event', todo: 'ev-todo' }
const KIND_NAME: Record<CalEvent['kind'], string> = { deadline: '마감', interview: '면접', event: '접수·통보', todo: '할 일' }
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function CalendarInner() {
  const { items: jobs } = useCollection<Job>('jobs')
  const { items: todos } = useCollection<Todo>('todos')
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(today())

  const events = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    const add = (date: string, ev: CalEvent) => {
      if (!date) return
      m.set(date, [...(m.get(date) ?? []), ev])
    }
    jobs.forEach((j) => {
      add(j.deadline, { kind: 'deadline', label: `${j.company} 마감${j.applied ? ' ✓' : ''}`, done: j.applied })
      add(j.interviewAt, { kind: 'interview', label: `${j.company} 면접` })
      add(j.eventDate, { kind: 'event', label: `${j.company} ${j.status === 'rejected' ? '결과 통보' : '접수'}` })
    })
    todos.forEach((t) => add(t.due, { kind: 'todo', label: t.text, done: t.done }))
    return m
  }, [jobs, todos])

  const first = new Date(cursor)
  const startOffset = first.getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)))]
  while (cells.length % 7) cells.push(null)

  const move = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  const selectedEvents = events.get(selected) ?? []

  return (
    <div className="stack">
      <PageHead icon="interview" title="캘린더" sub="마감 · 면접 · 접수 · 할 일을 한눈에">
          <button className="btn" onClick={() => move(-1)} aria-label="이전 달">
            ◀
          </button>
          <b className="month">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </b>
          <button className="btn" onClick={() => move(1)} aria-label="다음 달">
            ▶
          </button>
          <button
            className="btn"
            onClick={() => {
              const d = new Date()
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
              setSelected(today())
            }}
          >
            오늘
          </button>
        </PageHead>

      <div className="legend">
        {(Object.keys(KIND_NAME) as CalEvent['kind'][]).map((k) => (
          <span key={k} className={`ev ${KIND_STYLE[k]}`}>
            {KIND_NAME[k]}
          </span>
        ))}
      </div>

      <div className="cal card">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal-h ${i === 0 ? 'sun' : ''}`}>
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="cal-cell empty" />
          const evs = events.get(date) ?? []
          return (
            <button key={date} className={`cal-cell ${date === today() ? 'today' : ''} ${date === selected ? 'sel' : ''}`} onClick={() => setSelected(date)}>
              <span className="num">{Number(date.slice(8))}</span>
              {evs.slice(0, 3).map((e, k) => (
                <span key={k} className={`ev ${KIND_STYLE[e.kind]} ${e.done ? 'done' : ''}`}>
                  {e.label}
                </span>
              ))}
              {evs.length > 3 && <span className="muted small">+{evs.length - 3}</span>}
            </button>
          )
        })}
      </div>

      <section className="card">
        <h2>{selected}</h2>
        {selectedEvents.length === 0 ? (
          <p className="muted">이 날은 일정이 없어요.</p>
        ) : (
          <ul className="list">
            {selectedEvents.map((e, i) => (
              <li key={i}>
                <span className={`ev ${KIND_STYLE[e.kind]}`}>{KIND_NAME[e.kind]}</span> {e.label}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function Calendar() {
  return (
    <PrivateGate>
      <CalendarInner />
    </PrivateGate>
  )
}
