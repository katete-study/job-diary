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

/**
 * 소유자(KateteDeveloper)가 아니면 내용을 블러 처리하고 잠금 안내를 올린다.
 * 블러 아래에 보이는 건 sample.ts의 가짜 데이터일 뿐, 진짜 데이터는 서버가 내려주지 않는다.
 */
export function Locked({ children }: { children: ReactNode }) {
  const { isOwner, ready, user, signIn, demo } = useAuth()
  if (isOwner) return <>{children}</>
  if (!ready) return <Empty icon="rest">불러오는 중…</Empty>
  const inertProps = { inert: '' } as object
  return (
    <div className="locked">
      <div className="locked-blur" aria-hidden="true" {...inertProps}>
        {children}
      </div>
      <div className="locked-msg card">
        <Icon name="me" size={64} chip />
        <h3>주인장만 볼 수 있어요 🔒</h3>
        <p className="muted">{user ? '이 GitHub 계정은 열람 권한이 없어요.' : 'GitHub 로그인(KateteDeveloper)이 필요해요.'}</p>
        {!user && (
          <button className="btn primary" onClick={() => signIn()}>
            <Icon name="github" size={20} /> {demo ? '데모 로그인' : 'GitHub로 로그인'}
          </button>
        )}
      </div>
    </div>
  )
}

/** 페이지 전체를 잠글 때 쓰는 별칭 */
export const PrivateGate = Locked

/** 상태 뱃지 */
export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

/** 통계 카드 */
export function StatCard({ icon, label, value, hint, tone = '' }: { icon: string; label: string; value: ReactNode; hint?: string; tone?: string }) {
  return (
    <div className={`stat-card ${tone}`}>
      <Icon name={icon} size={34} chip />
      <div>
        <span className="stat-label">{label}</span>
        <b className="stat-value">{value}</b>
        {hint && <small className="muted">{hint}</small>}
      </div>
    </div>
  )
}

/** 페이지 상단 제목 줄 */
export function PageHead({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="row">
        <Icon name={icon} size={30} chip />
        <div>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>
      </div>
      <div className="row wrap">{children}</div>
    </div>
  )
}
