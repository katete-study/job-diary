# 백수의 취업 일기 (job-diary)

취업 준비 대시보드. **공부 기록은 누구나**, **채용공고 · 캘린더 · 이력서/자소서/포트폴리오 · 할 일은 GitHub 계정 `KateteDeveloper`만** 볼 수 있어요.

- 프런트: Vite + React + TypeScript
- 인증: Firebase Auth (GitHub 로그인)
- 데이터: Firestore (무료 Spark 요금제)
- 배포: GitHub Actions → Firebase Hosting (+ Firestore 보안 규칙)

## 접근 제어

프런트에서 숨기는 것만으로는 보안이 안 되기 때문에, **Firestore 보안 규칙**(`firestore.rules`)이 서버에서 검사해요.
GitHub 숫자 ID `192939184`(KateteDeveloper)가 아니면 `jobs` / `docs` / `todos`는 읽기·쓰기 모두 거부되고, `study`는 읽기만 허용돼요.

| 컬렉션 | 읽기 | 쓰기 |
| --- | --- | --- |
| `study` (공부 기록) | 누구나 | 소유자 |
| `jobs` (공고) | 소유자 | 소유자 |
| `docs` (이력서·자소서·포트폴리오·Claude 노트) | 소유자 | 소유자 |
| `todos` | 소유자 | 소유자 |

## 로컬 실행

```bash
npm install
npm run dev
```

`.env`가 없으면 **로컬 데모 모드**(localStorage)로 동작해요. 설정 → "샘플 데이터 채우기"로 화면을 확인할 수 있어요.

## 배포 설정 (한 번만)

1. **Firebase 프로젝트 생성** (Spark 무료 플랜) → Authentication에서 **GitHub** 로그인 사용 설정
2. **GitHub OAuth App 생성**: GitHub > Settings > Developer settings > OAuth Apps
   - Authorization callback URL = Firebase 콘솔 GitHub 제공업체 화면에 표시되는 URL
   - 발급된 Client ID / Secret을 Firebase 콘솔에 입력
3. Firebase에서 **Firestore Database** 생성(프로덕션 모드), **웹 앱 등록** 후 config 확인
4. Authentication > 설정 > **승인된 도메인**에 배포 도메인 추가 (`<project>.web.app`은 기본 포함)
5. **서비스 계정 키** 발급: Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성
   - 역할: `Firebase Hosting Admin`, `Firebase Rules Admin` (또는 `Firebase Admin`)
6. GitHub 저장소 설정
   - **Secrets** → `FIREBASE_SERVICE_ACCOUNT` = 키 JSON 전체
   - **Variables** → `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_OWNER_GITHUB_ID`(=`192939184`)
7. `main`에 push하면 `.github/workflows/deploy.yml`이 빌드 후 Hosting과 Firestore 규칙을 배포해요.

> Firebase 웹 config 값은 비밀이 아니에요(공개돼도 규칙이 보호). 진짜 비밀은 서비스 계정 키뿐이라 Secret으로만 두세요.

## Claude로 자소서 쓰기

- **문서** 탭에 "Claude 참고 노트"(내가 한 일: 상황/행동/결과), 이력서, 포트폴리오를 마크다운으로 저장
- **Claude 컨텍스트** 버튼: 포함 체크된 문서를 하나의 `.md`로 합쳐 복사/다운로드 (Obsidian이나 프로젝트 폴더에 넣어도 OK)
- **채용공고** 카드의 **Claude 프롬프트** 버튼: 그 공고 정보 + 내 배경 자료 + 요청문을 한 번에 복사

## 아이콘

`public/icons/*.png`는 아이콘 시트에서 잘라낸 것이에요. 파일명만 같게 바꿔 끼우면 교체할 수 있어요. 다크 모드에서는 흰 스티커 테두리가 자동으로 붙어요.

## 나중에 붙일 수 있는 것

- 사람인/잡코리아 URL에서 회사명·제목 **자동 채우기**: 브라우저(CORS)로는 불가능해서 Cloud Functions(Blaze 요금제, 카드 등록 필요)나 GitHub Action 스크래퍼가 필요해요. 지금은 사이트만 URL로 자동 인식하고 나머지는 직접 입력해요.
