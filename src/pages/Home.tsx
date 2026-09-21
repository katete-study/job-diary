import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Empty } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useCollection } from '../lib/store'
import type { Job, StudyEntry, Todo } from '../lib/types'
import { CATEGORY_ICON, CATEGORY_LABEL, daysLeft, ddayLabel, toDateStr, today, SOURCE_LABEL } from '../lib/util'

const WEEKS = 14

/** 날짜별 공부 기록 개수 → 연속 일수 */
function calcStreak(days: Set<string>): number {
  const d = new Date()
  if (!days.has(toDateStr(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(toDateStr(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

function Heatmap({ counts }: { counts: Map<string, number> }) {
  const cells = useMemo(() => {
    const start = new Date()
    start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7)
    const list: { date: string; n: number; future: boolean }[] = []
    const t = today()
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const s = toDateStr(d)
      list.push({ date: s, n: counts.get(s) ?? 0, future: s > t })
    }
    return list
  }, [counts])

  return (
    <div className="heat" aria-label="최근 공부 기록">
      {cells.map((c) => (
        <i key={c.date} className={`lv${Math.min(c.n, 3)} ${c.future ? 'future' : ''}`} title={`${c.date} · ${c.n}건`} />
      ))}
    </div>
  )
}

export default function Home() {
  const { isOwner, user } = useAuth()
  const { items: study } = useCollection<StudyEntry>('study')
  const { items: jobs } = useCollection<Job>('jobs', isOwner)
  const { items: todos } = useCollection<Todo>('todos', isOwner)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    study.forEach((s) => m.set(s.date, (m.get(s.date) ?? 0) + 1))
    return m
  }, [study])
  const streak = calcStreak(new Set(counts.keys()))
  const recent = [...study].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 4)

  const urgent = jobs
    .filter((j) => !j.applied && j.status === 'watching' && j.deadline && (daysLeft(j.deadline) ?? 99) >= 0 && (daysLeft(j.deadline) ?? 99) <= 7)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
  const interviews = jobs.filter((j) => j.interviewAt && (daysLeft(j.interviewAt) ?? -1) >= 0).sort((a, b) => a.interviewAt.localeCompare(b.interviewAt))
  const openTodos = todos.filter((t) => !t.done)
  const stat = (f: (j: Job) => boolean) => jobs.filter(f).length

  return (
    <div className="stack">
      <section className="hero card">
        <Icon name="mascot" size={120} />
        <div>
          <h1>{isOwner ? `${user?.name.replace(' (데모)', '')}의 취업 일기` : '백수의 열심히 하는 공부 일기'}</h1>
          <p>{isOwner ? '마감 놓치지 말고, 오늘도 차근차근 준비해요!' : '취업을 준비하며 매일 공부한 기록을 남기고 있어요. 구경하고 가세요 🥕'}</p>
        </div>
      </section>

      {isOwner && (
        <>
          <section className="grid stats">
            <div className="stat">
              <Icon name="applications" size={40} />
              <b>{stat((j) => j.applied)}</b>
              <span>지원 완료</span>
            </div>
            <div className="stat">
              <Icon name="coverletter" size={40} />
              <b>{stat((j) => j.applied && j.status === 'document')}</b>
              <span>서류 심사 중</span>
            </div>
            <div className="stat">
              <Icon name="interview" size={40} />
              <b>{stat((j) => j.status === 'interview')}</b>
              <span>면접 단계</span>
            </div>
            <div className="stat">
              <Icon name="success" size={40} />
              <b>{stat((j) => j.status === 'offer')}</b>
              <span>합격</span>
            </div>
          </section>

          <section className="grid two">
            <div className="card">
              <h2>
                <Icon name="bell" size={26} /> 마감 임박 · 아직 미지원
              </h2>
              {urgent.length === 0 ? (
                <p className="muted">7일 안에 마감되는 미지원 공고가 없어요 👍</p>
              ) : (
                <ul className="list">
                  {urgent.map((j) => (
                    <li key={j.id}>
                      <span className={`dday ${(daysLeft(j.deadline) ?? 9) <= 2 ? 'hot' : ''}`}>{ddayLabel(j.deadline)}</span>
                      <Link to="/jobs">
                        <b>{j.company || '(회사 미입력)'}</b> {j.title}
                      </Link>
                      <span className="badge">{SOURCE_LABEL[j.source]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <h2>
                <Icon name="interview" size={26} /> 다가오는 면접
              </h2>
              {interviews.length === 0 ? (
                <p className="muted">예정된 면접이 아직 없어요.</p>
              ) : (
                <ul className="list">
                  {interviews.slice(0, 5).map((j) => (
                    <li key={j.id}>
                      <span className="dday">{ddayLabel(j.interviewAt)}</span>
                      <Link to="/calendar">
                        <b>{j.company}</b> {j.interviewAt}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card">
            <h2>
              <Icon name="todo" size={26} /> 남은 할 일 {openTodos.length}개
            </h2>
            {openTodos.length === 0 ? (
              <p className="muted">
                할 일을 다 끝냈어요! <Link to="/todos">새로 추가</Link>
              </p>
            ) : (
              <ul className="list">
                {openTodos.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    {t.due && <span className="dday">{ddayLabel(t.due)}</span>}
                    <Link to="/todos">{t.text}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="card">
        <h2>
          <Icon name="growth" size={30} /> 공부 현황
        </h2>
        <div className="grid stats small">
          <div className="stat">
            <b>{streak}일</b>
            <span>연속 공부</span>
          </div>
          <div className="stat">
            <b>{study.length}개</b>
            <span>누적 기록</span>
          </div>
          <div className="stat">
            <b>{new Set(study.map((s) => s.date)).size}일</b>
            <span>공부한 날</span>
          </div>
        </div>
        <Heatmap counts={counts} />
      </section>

      <section className="card">
        <div className="row between">
          <h2>
            <Icon name="study" size={28} /> 최근 공부 기록
          </h2>
          <Link to="/study" className="btn ghost">
            전체 보기 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <Empty icon="rest">아직 기록이 없어요. 곧 채워질 거예요!</Empty>
        ) : (
          <ul className="list">
            {recent.map((s) => (
              <li key={s.id}>
                <Icon name={CATEGORY_ICON[s.category]} size={26} chip />
                <Link to="/study" state={{ open: s.id }}>
                  <b>{s.title}</b>
                </Link>
                <span className="badge">{CATEGORY_LABEL[s.category]}</span>
                <span className="muted small">{s.date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
