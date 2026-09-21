import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../lib/auth'
import { copyText } from '../lib/util'

/**
 * 아이콘 시트에서 잘라낸 PNG를 보여준다. 다크 모드에서도 잘 보이도록 파스텔 칩 위에 올린다.
 * @param name public/icons 아래 파일명(확장자 제외)
 * @param size 픽셀 크기
 * @param chip true면 배경 칩을 깐다
 */
export function Icon({ name, size = 28, chip = false }: { name: string; size?: number; chip?: boolean }) {
  const img = <img src={`/icons/${name}.png`} width={size} height={size} alt="" draggable={false} />
  if (!chip) return img
  return (
    <span className="icon-chip" style={{ width: size + 12, height: size + 12 }}>
      {img}
    </span>
  )
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CopyButton({ text, label = '복사', className = 'btn' }: { text: string | (() => string); label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className={className}
      onClick={async () => {
        const ok = await copyText(typeof text === 'function' ? text() : text)
        setDone(ok)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? '복사했어요 ✓' : label}
    </button>
  )
}

export function Empty({ icon = 'rest', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={72} />
      <p>{children}</p>
    </div>
  )
}

/** 소유자(KateteDeveloper)에게만 내용을 보여주는 래퍼 */
export function PrivateGate({ children }: { children: ReactNode }) {
  const { isOwner, ready, user, signIn, demo } = useAuth()
  if (!ready) return <Empty icon="rest">불러오는 중…</Empty>
  if (isOwner) return <>{children}</>
  return (
    <div className="empty lock">
      <Icon name="me" size={96} />
      <h2>여기는 주인장만 볼 수 있어요 🔒</h2>
      <p>{user ? '이 GitHub 계정은 열람 권한이 없어요. 공부 기록은 자유롭게 구경하세요!' : '취업 대시보드는 GitHub 로그인(KateteDeveloper)이 필요해요.'}</p>
      {!user && (
        <button className="btn primary" onClick={() => signIn()}>
          <Icon name="github" size={20} /> {demo ? '데모 로그인' : 'GitHub로 로그인'}
        </button>
      )}
    </div>
  )
}
