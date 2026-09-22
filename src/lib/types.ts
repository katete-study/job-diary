/** Firestore/로컬 저장소에 들어가는 모든 문서의 공통 필드 */
export interface Entity {
  id: string
  createdAt: number
  updatedAt: number
}

export type CollectionName = 'study' | 'jobs' | 'docs' | 'todos'

export type StudyCategory = 'study' | 'devstudy' | 'project' | 'stack'

/** 공개 공부 기록 */
export interface StudyEntry extends Entity {
  /** YYYY-MM-DD */
  date: string
  category: StudyCategory
  title: string
  /** 마크다운 */
  content: string
  tags: string[]
}

export type JobSource = 'saramin' | 'jobkorea' | 'wanted' | 'other'

/** 고려 중 → 지원 예정 → 작성 중 → 제출 완료 → 면접 → 합격/불합격, 그 외 보류·다른 공고로 전환 */
export type JobStatus = 'considering' | 'planned' | 'writing' | 'submitted' | 'interview' | 'offer' | 'rejected' | 'hold' | 'switched'

/** 채용 공고 (비공개) */
export interface Job extends Entity {
  url: string
  source: JobSource
  company: string
  title: string
  /** 마감일 YYYY-MM-DD, 없으면 빈 문자열 */
  deadline: string
  /** 면접일 YYYY-MM-DD, 없으면 빈 문자열 */
  interviewAt: string
  /** 접수·결과 통보일 YYYY-MM-DD, 없으면 빈 문자열 */
  eventDate: string
  status: JobStatus
  /** 실제로 지원했는지 (on/off) */
  applied: boolean
  favorite: boolean
  note: string
}

export type DocType = 'resume' | 'coverletter' | 'portfolio' | 'claude'

/** 이력서/자소서/포트폴리오/Claude 참고 노트 (비공개) */
export interface DocEntry extends Entity {
  type: DocType
  title: string
  /** 마크다운 */
  content: string
  /** 특정 공고용 문서라면 공고 id */
  jobId: string
  /** YYYY-MM-DD */
  date: string
  /** Claude 컨텍스트 내보내기에 포함할지 */
  includeInContext: boolean
}

/** 공부, 지원 준비, 기타 개인 용무 - 할 일이 많아졌을 때 한눈에 구분하기 위한 분류 */
export type TodoCategory = 'study' | 'apply' | 'life'

export interface Todo extends Entity {
  text: string
  done: boolean
  /** YYYY-MM-DD, 없으면 빈 문자열 */
  due: string
  category: TodoCategory
  /** 문제/공고 등 참고 링크. 없으면 빈 문자열 */
  url: string
}

export interface AppUser {
  name: string
  avatar: string
}
