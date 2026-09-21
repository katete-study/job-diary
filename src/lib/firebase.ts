import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** Firebase 설정이 있으면 true. false면 localStorage 기반 "로컬 데모 모드"로 동작한다. */
export const hasFirebase = Boolean(cfg.apiKey && cfg.projectId)

/** 편집/비공개 열람이 허용된 GitHub 숫자 ID */
export const OWNER_GITHUB_ID = (import.meta.env.VITE_OWNER_GITHUB_ID as string | undefined) ?? '192939184'

const app = hasFirebase ? initializeApp(cfg) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
