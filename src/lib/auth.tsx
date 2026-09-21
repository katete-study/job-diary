import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { GithubAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { auth, hasFirebase, OWNER_GITHUB_ID } from './firebase'
import type { AppUser } from './types'

interface AuthState {
  user: AppUser | null
  /** GitHub 계정이 KateteDeveloper(소유자)인지 */
  isOwner: boolean
  ready: boolean
  /** true면 Firebase 없이 localStorage로 동작 중 */
  demo: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const DEMO_KEY = 'jd:demo-owner'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (hasFirebase && auth) {
      return onAuthStateChanged(auth, (u) => {
        if (!u) {
          setUser(null)
          setIsOwner(false)
        } else {
          const gh = u.providerData.find((p) => p.providerId === 'github.com')
          setUser({ name: u.displayName ?? 'GitHub 사용자', avatar: u.photoURL ?? '' })
          setIsOwner(gh?.uid === OWNER_GITHUB_ID)
        }
        setReady(true)
      })
    }
    if (localStorage.getItem(DEMO_KEY) === '1') {
      setUser({ name: 'KateteDeveloper (데모)', avatar: '' })
      setIsOwner(true)
    }
    setReady(true)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isOwner,
      ready,
      demo: !hasFirebase,
      signIn: async () => {
        if (hasFirebase && auth) {
          await signInWithPopup(auth, new GithubAuthProvider())
        } else {
          localStorage.setItem(DEMO_KEY, '1')
          setUser({ name: 'KateteDeveloper (데모)', avatar: '' })
          setIsOwner(true)
        }
      },
      signOut: async () => {
        if (hasFirebase && auth) {
          await fbSignOut(auth)
        } else {
          localStorage.removeItem(DEMO_KEY)
          setUser(null)
          setIsOwner(false)
        }
      },
    }),
    [user, isOwner, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 안에서만 사용할 수 있어요')
  return ctx
}
