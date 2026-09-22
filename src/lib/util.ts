import type { DocEntry, DocType, Job, JobSource, JobStatus, StudyCategory, TodoCategory } from './types'

export const uid = () => crypto.randomUUID()

/** 로컬 시간 기준 YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const today = () => toDateStr(new Date())

/**
 * 오늘 기준 남은 일수. 날짜가 없으면 null.
 * @param date YYYY-MM-DD
 */
export function daysLeft(date: string): number | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - base) / 86400000)
}

export function ddayLabel(date: string): string {
  const n = daysLeft(date)
  if (n === null) return '상시'
  if (n === 0) return 'D-DAY'
  return n > 0 ? `D-${n}` : `D+${-n}`
}

/** 공고 URL로 채용 사이트를 추정한다 */
export function detectSource(url: string): JobSource {
  const u = url.toLowerCase()
  if (u.includes('saramin')) return 'saramin'
  if (u.includes('jobkorea')) return 'jobkorea'
  if (u.includes('wanted')) return 'wanted'
  return 'other'
}

export const SOURCE_LABEL: Record<JobSource, string> = {
  saramin: '사람인',
  jobkorea: '잡코리아',
  wanted: '원티드',
  other: '기타',
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  considering: '고려 중',
  planned: '지원 예정',
  writing: '작성 중',
  submitted: '제출 완료',
  interview: '면접',
  offer: '합격',
  rejected: '불합격',
  hold: '보류',
  switched: '전환됨',
}

/** 상태 뱃지 색상 톤 (CSS .pill.<tone>) */
export const STATUS_TONE: Record<JobStatus, string> = {
  considering: 'muted',
  planned: 'blue',
  writing: 'violet',
  submitted: 'green',
  interview: 'amber',
  offer: 'green',
  rejected: 'red',
  hold: 'muted',
  switched: 'muted',
}

export const CATEGORY_LABEL: Record<StudyCategory, string> = {
  study: '공부하기',
  devstudy: '개발 학습',
  project: '스터디/프로젝트',
  stack: '기술 스택',
}

/** 공부 카테고리별 아이콘 파일명 */
export const CATEGORY_ICON: Record<StudyCategory, string> = {
  study: 'study',
  devstudy: 'devstudy',
  project: 'project',
  stack: 'stack',
}

export const DOC_LABEL: Record<DocType, string> = {
  resume: '이력서',
  coverletter: '자기소개서',
  portfolio: '포트폴리오',
  claude: 'Claude 참고 노트',
}

/** 문서 타입별 아이콘 파일명 */
export const DOC_ICON: Record<DocType, string> = {
  resume: 'resume',
  coverletter: 'coverletter',
  portfolio: 'project',
  claude: 'dev',
}

export const TODO_CATEGORY_LABEL: Record<TodoCategory, string> = {
  study: '공부',
  apply: '지원',
  life: '기타',
}

/** 할 일 분류별 뱃지 색상 톤 (CSS .pill.<tone>) */
export const TODO_CATEGORY_TONE: Record<TodoCategory, string> = {
  study: 'blue',
  apply: 'violet',
  life: 'muted',
}

/** Claude에게 붙여 넣을 "내 배경 자료" 마크다운을 만든다 */
export function buildClaudeContext(docs: DocEntry[]): string {
  const order: DocType[] = ['claude', 'resume', 'portfolio', 'coverletter']
  const picked = docs
    .filter((d) => d.includeInContext)
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || b.date.localeCompare(a.date))
  const body = picked.map((d) => `## [${DOC_LABEL[d.type]}] ${d.title} (${d.date})\n\n${d.content.trim()}`).join('\n\n---\n\n')
  return `# 내 지원 배경 자료\n\n> 자기소개서/이력서 작성 시 참고할 내 경험과 문서 모음입니다.\n\n${body || '(포함된 문서가 없습니다)'}\n`
}

/** 특정 공고에 맞는 자소서 초안을 요청하는 Claude 프롬프트를 만든다 */
export function buildJobPrompt(job: Job, docs: DocEntry[]): string {
  const head = [
    '# 지원 공고',
    `- 회사: ${job.company || '(미입력)'}`,
    `- 공고: ${job.title || '(미입력)'}`,
    `- 링크: ${job.url || '(없음)'}`,
    `- 마감: ${job.deadline || '상시'}`,
    job.note ? `- 메모: ${job.note}` : '',
  ].filter(Boolean)
  return [
    head.join('\n'),
    buildClaudeContext(docs),
    '# 요청\n위 공고의 요구사항에 맞춰 내 경험을 근거로 자기소개서 초안을 작성해줘. 과장하지 말고, 자료에 없는 내용은 지어내지 말아줘.',
  ].join('\n\n')
}

/** 텍스트를 파일로 내려받는다 */
export function downloadText(filename: string, text: string, mime = 'text/markdown') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
