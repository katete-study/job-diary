import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon } from './ui'

type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'jd:theme'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme) || 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [theme])
  return { theme, cycle: () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')) }
}

const THEME_ICON: Record<Theme, string> = { system: '🌗', light: '☀️', dark: '🌙' }
const THEME_TEXT: Record<Theme, string> = { system: '시스템', light: '라이트', dark: '다크' }

interface NavItem {
  to: string
  label: string
  icon: string
  /** true면 소유자가 아닐 때 블러 처리되는 메뉴 */
  owner: boolean
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: '대시보드',
    items: [
      { to: '/', label: '홈', icon: 'home', owner: false },
      { to: '/study', label: '공부 기록', icon: 'study', owner: false },
    ],
  },
  {
    title: '취업 준비',
    items: [
      { to: '/jobs', label: '채용공고', icon: 'jobs', owner: true },
      { to: '/calendar', label: '캘린더', icon: 'interview', owner: true },
      { to: '/docs', label: '문서 보관함', icon: 'resume', owner: true },
      { to: '/todos', label: '할 일', icon: 'todo', owner: true },
    ],
  },
]

export default function Layout() {
  const { user, isOwner, signIn, signOut, demo } = useAuth()
  const { theme, cycle } = useTheme()

  return (
    <div className="shell">
      <aside className="side">
        <NavLink to="/" className="brand">
          <Icon name="mascot" size={40} />
          <span>
            <b>취업 일기</b>
            <small>job-diary</small>
          </span>
        </NavLink>

        <nav aria-label="메뉴">
          {NAV_GROUPS.map((g) => (
            <div key={g.title} className="nav-group">
              <span className="nav-title">{g.title}</span>
              {g.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon name={n.icon} size={22} chip />
                  <span>{n.label}</span>
                  {n.owner && !isOwner && <em className="lock" title="주인장 전용">🔒</em>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          {isOwner && (
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon name="settings" size={22} chip />
              <span>설정 · 백업</span>
            </NavLink>
          )}
          <button className="nav-item" onClick={cycle} title="테마 변경">
            <span className="theme-emoji">{THEME_ICON[theme]}</span>
            <span>테마: {THEME_TEXT[theme]}</span>
          </button>
          <div className="user-card">
            {user?.avatar ? <img className="avatar" src={user.avatar} alt="" /> : <Icon name="me" size={34} chip />}
            <div>
              <b>{user ? user.name : '방문자'}</b>
              <small className="muted">{isOwner ? '주인장' : user ? '열람 권한 없음' : '로그인 필요'}</small>
            </div>
            {user ? (
              <button className="btn ghost" onClick={() => signOut()} title="로그아웃">
                <Icon name="logout" size={20} />
              </button>
            ) : (
              <button className="btn primary sm" onClick={() => signIn()}>
                {demo ? '데모' : <Icon name="github" size={18} />}
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="content">
        {demo && (
          <div className="banner">
            🧪 Firebase 설정이 없어 <b>로컬 데모 모드</b>(이 브라우저에만 저장)로 동작 중이에요.
          </div>
        )}
        <main>
          <Outlet />
        </main>
        <footer className="foot">
          <Icon name="cheer" size={40} />
          <a href="https://github.com/katete-study" target="_blank" rel="noreferrer">
            github.com/katete-study
          </a>
        </footer>
      </div>
    </div>
  )
}
