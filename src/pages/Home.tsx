import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Icon, Locked, PageHead, Pill, StatCard } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useCollection } from '../lib/store'
import type { Job, StudyEntry, Todo } from '../lib/types'
import { CATEGORY_ICON, CATEGORY_LABEL, daysLeft, ddayLabel, STATUS_LABEL, STATUS_TONE, toDateStr, today } from '../lib/util'

const WEEKS = 20

/** 날짜별 공부 기록이 있는 날 → 연속 일수 */
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
  const { items: jobs } = useCollection<Job>('jobs')
  const { items: todos } = useCollection<Todo>('todos')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    study.forEach((s) => m.set(s.date, (m.get(s.date) ?? 0) + 1))
    return m
  }, [study])
  const streak = calcStreak(new Set(counts.keys()))
  const recent = [...study].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 5)

  const open = jobs.filter((j) => !['rejected', 'switched', 'hold', 'offer'].includes(j.status))
  const urgent = open
    .filter((j) => !j.applied && j.deadline && (daysLeft(j.deadline) ?? -1) >= 0 && (daysLeft(j.deadline) ?? 99) <= 7)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
  const upcoming = jobs.filter((j) => j.interviewAt && (daysLeft(j.interviewAt) ?? -1) >= 0).sort((a, b) => a.interviewAt.localeCompare(b.interviewAt))
  const openTodos = todos.filter((t) => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  const board = [...jobs]
    .sort((a, b) => Number(!!b.deadline && (daysLeft(b.deadline) ?? -1) >= 0) - Number(!!a.deadline && (daysLeft(a.deadline) ?? -1) >= 0) || (a.deadline || '9999').localeCompare(b.deadline || '9999'))
    .slice(0, 7)

  return (
    <div className="stack">
      <PageHead icon="home" title="대시보드" sub={isOwner ? `${user?.name.replace(' (데모)', '')}님, 오늘도 차근차근 준비해요` : '취업 준비 · 공부 기록 대시보드'}>
        <Link to="/study" className="btn">
          공부 기록 보기
        </Link>
      </PageHead>

      <Locked>
        <div className="stack">
          <section className="stats-row">
            <StatCard icon="applications" label="지원 완료" value={jobs.filter((j) => j.applied).length} hint="제출한 공고" />
            <StatCard icon="coverletter" label="결과 대기" value={jobs.filter((j) => j.status === 'submitted').length} hint="제출 완료 상태" />
            <StatCard icon="todo" label="준비 중" value={jobs.filter((j) => ['considering', 'planned', 'writing'].includes(j.status)).length} hint="고려·예정·작성 중" />
            <StatCard icon="bell" label="마감 임박" value={urgent.length} hint="7일 내 · 미지원" tone={urgent.length ? 'warn' : ''} />
            <StatCard icon="success" label="합격" value={jobs.filter((j) => j.status === 'offer').length} hint="최종 합격" />
          </section>

          <section className="main-grid">
            <div className="card">
              <div className="card-head">
                <h2>지원 현황</h2>
                <Link to="/jobs" className="link">
                  전체 보기 →
                </Link>
              </div>
              {board.length === 0 ? (
                <Empty icon="search">아직 등록한 공고가 없어요.</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>회사</th>
                        <th>직무</th>
                        <th>상태</th>
                        <th>마감</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.map((j) => (
                        <tr key={j.id}>
                          <td>
                            <span className="co">
                              <i className="logo">{(j.company || '?').slice(0, 1)}</i>
                              <b>{j.company}</b>
                            </span>
                          </td>
                          <td className="muted">{j.title}</td>
                          <td>
                            <Pill tone={STATUS_TONE[j.status]}>{STATUS_LABEL[j.status]}</Pill>
                          </td>
                          <td>
                            {j.deadline ? (
                              <span className={`dday ${(daysLeft(j.deadline) ?? 9) >= 0 && (daysLeft(j.deadline) ?? 9) <= 2 ? 'hot' : ''}`}>{ddayLabel(j.deadline)}</span>
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-head">
                  <h2>
                    <Icon name="bell" size={22} /> 마감 임박
                  </h2>
                </div>
                {urgent.length === 0 ? (
                  <p className="muted">7일 안에 마감되는 미지원 공고가 없어요 👍</p>
                ) : (
                  <ul className="list">
                    {urgent.map((j) => (
                      <li key={j.id}>
                        <span className={`dday ${(daysLeft(j.deadline) ?? 9) <= 2 ? 'hot' : ''}`}>{ddayLabel(j.deadline)}</span>
                        <span>
                          <b>{j.company}</b> <span className="muted">{j.title}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card">
                <div className="card-head">
                  <h2>
                    <Icon name="interview" size={22} /> 다가오는 면접
                  </h2>
                </div>
                {upcoming.length === 0 ? (
                  <p className="muted">예정된 면접이 아직 없어요.</p>
                ) : (
                  <ul className="list">
                    {upcoming.slice(0, 4).map((j) => (
                      <li key={j.id}>
                        <span className="dday">{ddayLabel(j.interviewAt)}</span>
                        <span>
                          <b>{j.company}</b> <span className="muted">{j.interviewAt}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card">
                <div className="card-head">
                  <h2>
                    <Icon name="todo" size={22} /> 할 일 {openTodos.length}
                  </h2>
                  <Link to="/todos" className="link">
                    관리 →
                  </Link>
                </div>
                {openTodos.length === 0 ? (
                  <p className="muted">할 일을 다 끝냈어요!</p>
                ) : (
                  <ul className="list">
                    {openTodos.slice(0, 5).map((t) => (
                      <li key={t.id}>
                        {t.due && <span className="dday">{ddayLabel(t.due)}</span>}
                        <span>{t.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      </Locked>

      <section className="card">
        <div className="card-head">
          <h2>
            <Icon name="growth" size={26} /> 공부 현황
          </h2>
          <span className="muted small">최근 {WEEKS}주 · 누구나 볼 수 있어요</span>
        </div>
        <div className="mini-stats">
          <div>
            <b>{streak}일</b>
            <span>연속 공부</span>
          </div>
          <div>
            <b>{study.length}개</b>
            <span>누적 기록</span>
          </div>
          <div>
            <b>{new Set(study.map((s) => s.date)).size}일</b>
            <span>공부한 날</span>
          </div>
        </div>
        <Heatmap counts={counts} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <Icon name="study" size={26} /> 최근 공부 기록
          </h2>
          <Link to="/study" className="link">
            전체 보기 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <Empty icon="rest">아직 기록이 없어요. 곧 채워질 거예요!</Empty>
        ) : (
          <ul className="list">
            {recent.map((s) => (
              <li key={s.id}>
                <Icon name={CATEGORY_ICON[s.category]} size={24} chip />
                <Link to="/study" state={{ open: s.id }}>
                  <b>{s.title}</b>
                </Link>
                <span className="badge">{CATEGORY_LABEL[s.category]}</span>
                <span className="muted small push">{s.date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
