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
  /** true면 소유자에게만 보인다 */
  owner: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: '홈', icon: 'home', owner: false },
  { to: '/study', label: '공부', icon: 'study', owner: false },
  { to: '/jobs', label: '채용공고', icon: 'jobs', owner: true },
  { to: '/calendar', label: '캘린더', icon: 'interview', owner: true },
  { to: '/docs', label: '문서', icon: 'resume', owner: true },
  { to: '/todos', label: '할 일', icon: 'todo', owner: true },
]

export default function Layout() {
  const { user, isOwner, signIn, signOut, demo } = useAuth()
  const { theme, cycle } = useTheme()
  const items = NAV.filter((n) => !n.owner || isOwner)

  return (
    <div className="app">
      <header className="top">
        <NavLink to="/" className="brand">
          <Icon name="mascot" size={44} />
          <span>
            <b>백수의 취업 일기</b>
            <small>오늘도 한 걸음씩 🥕</small>
          </span>
        </NavLink>
        <div className="top-actions">
          <button className="btn ghost" onClick={cycle} title={`테마: ${THEME_TEXT[theme]}`}>
            {THEME_ICON[theme]}
          </button>
          {isOwner && (
            <NavLink to="/settings" className="btn ghost" title="설정">
              <Icon name="settings" size={22} />
            </NavLink>
          )}
          {user ? (
            <button className="btn" onClick={() => signOut()} title="로그아웃">
              {user.avatar ? <img className="avatar" src={user.avatar} alt="" /> : <Icon name="logout" size={18} />}
              <span className="hide-sm">로그아웃</span>
            </button>
          ) : (
            <button className="btn primary" onClick={() => signIn()}>
              <Icon name="github" size={18} />
              <span>{demo ? '데모 로그인' : 'GitHub 로그인'}</span>
            </button>
          )}
        </div>
      </header>

      <nav className="tabs" aria-label="메뉴">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            <Icon name={n.icon} size={26} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      {demo && (
        <div className="banner">
          🧪 Firebase 설정이 없어 <b>로컬 데모 모드</b>(이 브라우저에만 저장)로 동작 중이에요. 배포하면 자동으로 Firebase를 사용해요.
        </div>
      )}

      <main>
        <Outlet />
      </main>

      <footer className="foot">
        <Icon name="cheer" size={44} />
        <a href="https://github.com/katete-study" target="_blank" rel="noreferrer">
          github.com/katete-study
        </a>
      </footer>
    </div>
  )
}
