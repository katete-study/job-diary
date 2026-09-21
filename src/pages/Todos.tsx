import { useState } from 'react'
import { Empty, Icon, PrivateGate } from '../components/ui'
import { useCollection, useCrud } from '../lib/store'
import type { Todo } from '../lib/types'
import { ddayLabel, uid } from '../lib/util'

function TodosInner() {
  const { items, ready } = useCollection<Todo>('todos')
  const { save, remove } = useCrud<Todo>('todos')
  const [text, setText] = useState('')
  const [due, setDue] = useState('')

  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt - b.createdAt)

  return (
    <div className="stack">
      <h1>
        <Icon name="todo" size={40} /> 할 일 목록
      </h1>
      <form
        className="card row wrap"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          await save({ id: uid(), text: text.trim(), done: false, due })
          setText('')
          setDue('')
        }}
      >
        <input className="grow" placeholder="예: 카카오 코딩테스트 풀어보기" value={text} onChange={(e) => setText(e.target.value)} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="기한" />
        <button className="btn primary">추가</button>
      </form>

      {!ready ? (
        <Empty>불러오는 중…</Empty>
      ) : sorted.length === 0 ? (
        <Empty icon="fighting">할 일이 없어요. 오늘도 화이팅!</Empty>
      ) : (
        <ul className="card list todo-list">
          {sorted.map((t) => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <label className="check">
                <input type="checkbox" checked={t.done} onChange={(e) => save({ ...t, done: e.target.checked })} />
                <span>{t.text}</span>
              </label>
              {t.due && <span className="dday">{ddayLabel(t.due)}</span>}
              <button className="btn ghost push" onClick={() => remove(t.id)} aria-label="삭제">
                🗑
              </button>
            </li>
          ))}
        </ul>
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
