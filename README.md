# CLIPPING — 기사를 오려, 나만의 매거진을 만들다

뷰티·패션·IT·인문학·경제·시사 기사를 검색하고, 클릭 한 번으로 AI 카드뉴스 5컷을 만드는 Next.js 앱입니다.

## 지금 상태 (키를 넣기 전)

API 키 없이 그냥 배포해도 정상적으로 동작합니다. 대신:
- 뉴스·유튜브·구글 검색은 각각 내장된 **샘플 데이터**(뉴스 30개, 유튜브 12개, 구글 12개) 안에서 필터링돼요.
- 키워드가 샘플 데이터와 전혀 안 맞으면 결과 0건으로 나와요 (엉뚱한 결과를 보여주지 않도록 일부러 그렇게 만들었어요).
- "AI 일러스트 생성" 버튼을 누르면 실제 이미지 API 대신 **미리보기용 목업 이미지**가 나와요.

세 검색 소스와 이미지 생성 모두 아래 안내대로 키를 넣으면 "진짜"로 바뀝니다. 소스별로 독립적이라 하나씩 순서대로 연결해도 돼요.

## 1. 로컬에서 실행해보기 (선택)

```bash
npm install
npm run dev
```
→ http://localhost:3000

로컬 테스트 없이 바로 GitHub → Vercel로 배포해도 됩니다.

## 2. GitHub에 올리기

이 폴더를 그대로 새 저장소에 push 하면 됩니다. 평소 하시던 방식 그대로예요.

```bash
git init
git add .
git commit -m "clipping magazine app"
git branch -M main
git remote add origin https://github.com/내계정/clipping.git
git push -u origin main
```

## 3. Vercel로 배포하기 (딱 한 번만 하면 됨)

1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. **Add New → Project** 클릭
3. 방금 올린 GitHub 저장소 선택 → **Import**
4. Framework는 Next.js가 자동으로 감지됩니다. 설정 건드릴 것 없이 **Deploy** 클릭
5. 1~2분 뒤 `https://프로젝트이름.vercel.app` 링크가 생깁니다

이후로는 GitHub에 `git push` 할 때마다 Vercel이 **자동으로 재배포**해줍니다. 별도로 다시 배포 버튼을 누를 필요 없어요.

## 4. 실제 뉴스·유튜브·구글로 바꾸기

세 소스는 각각 독립적인 키가 필요해요. 하나만 연결해도 그 소스만 실시간으로 바뀌고, 나머지는 계속 샘플로 동작해요.

### 네이버 뉴스
1. https://developers.naver.com/apps/#/register 에서 애플리케이션 등록 (무료)
2. 사용 API에서 **검색** 체크 → Client ID / Client Secret 확인
3. Vercel 환경변수에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 추가

### 유튜브
1. https://console.cloud.google.com 에서 프로젝트 생성
2. **API 및 서비스 → 라이브러리**에서 "YouTube Data API v3" 검색 후 사용 설정
3. **사용자 인증 정보**에서 API 키 발급 (무료 할당량 내에서 사용 가능, 초과 시 과금)
4. Vercel 환경변수에 `YOUTUBE_API_KEY` 추가

### 구글 웹 검색
1. https://programmablesearchengine.google.com 에서 검색엔진 생성 → 검색엔진 ID(cx) 확인
2. https://console.cloud.google.com 에서 "Custom Search API" 사용 설정 후 API 키 발급
3. Vercel 환경변수에 `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` 추가 (무료 하루 100건, 초과 시 과금)

키 추가 후 **Redeploy** 하면 반영돼요 (Deployments 탭 → 최신 배포 → Redeploy).

### 정렬 기준

- **인기순**: 유튜브는 조회수(`order=viewCount`) 기준. 네이버 뉴스는 정확도순, 구글은 관련도순으로 대체돼요 (두 서비스 다 "조회수" 개념이 없어서 완전한 인기순 정렬은 지원하지 않아요).
- **최신순**: 세 소스 모두 게시일 기준 최신순으로 정렬돼요.

## 5. 진짜 AI 일러스트로 바꾸기

1. https://platform.openai.com 에서 API 키 발급 (유료 과금, 이미지 1장당 비용 발생)
2. Vercel 환경변수에 `OPENAI_API_KEY` 추가 후 Redeploy

키가 없으면 카드마다 목업 미리보기가, 키가 있으면 실제 생성 이미지가 나옵니다 (`app/api/illustrate/route.js` 참고). 다른 이미지 생성 서비스(Stability AI 등)를 쓰고 싶다면 이 파일의 fetch 호출부만 바꾸면 됩니다.

## 6. 무료 스톡 사진을 실제로 키워드에 맞게 바꾸기

1. https://unsplash.com/join 에서 계정 생성
2. https://unsplash.com/developers → "New Application" 으로 앱 등록 (무료, 심사 없이 바로 개발용 키 발급)
3. Access Key 복사 → Vercel 환경변수에 `UNSPLASH_ACCESS_KEY` 추가 후 Redeploy

키가 없으면 무작위 예시 이미지(키워드 무관)가 나오고, 키를 넣으면 카드 제목과 관련된 실제 사진을 Unsplash에서 검색해서 보여줘요. 개발용 키는 시간당 50회 제한이 있어요 (넘으면 자동으로 예시 이미지로 대체됩니다).

## 폴더 구조

```
app/
  page.js              메인 화면 (검색 · 카드뉴스 에디터)
  layout.js            공통 레이아웃, 폰트
  globals.css           전체 스타일
  api/search/route.js   기사 검색 (네이버 API or 샘플 데이터)
  api/illustrate/route.js  AI 일러스트 생성 (이미지 API or 목업)
lib/
  mockArticles.js       샘플 기사 30개 + 카테고리/키워드 정의
```


