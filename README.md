# CLIPPING — 기사를 오려, 나만의 매거진을 만들다

뷰티·패션·IT·인문학·경제·시사 기사를 검색하고, 클릭 한 번으로 AI 카드뉴스 5컷을 만드는 Next.js 앱입니다.

## 지금 상태 (키를 넣기 전)

API 키 없이 그냥 배포해도 정상적으로 동작합니다. 대신:
- 뉴스·유튜브·구글 검색은 각각 내장된 **샘플 데이터**(뉴스 30개, 유튜브 12개, 구글 12개) 안에서 필터링돼요.
- 키워드가 샘플 데이터와 전혀 안 맞으면 결과 0건으로 나와요 (엉뚱한 결과를 보여주지 않도록 일부러 그렇게 만들었어요).
- "AI 일러스트 생성" 버튼은 기본적으로 무료 서비스(Pollinations.ai)로 실제 이미지를 만들어요. 키 설정 없이도 동작해요.

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

## 5. AI 일러스트 — 이제 키 없이도 진짜로 동작해요

**설정할 게 없어요.** AI 일러스트 생성 버튼은 기본적으로 [Pollinations.ai](https://pollinations.ai)라는 완전 무료·가입 불필요 이미지 생성 서비스를 사용하도록 되어 있어요. 지금 그대로 배포하면 바로 진짜 이미지가 생성돼요.

더 고품질(정밀한 스타일 제어)을 원하면 유료로 업그레이드할 수 있어요:
1. https://platform.openai.com 에서 API 키 발급 (유료 과금, 이미지 1장당 비용 발생)
2. Vercel 환경변수에 `OPENAI_API_KEY` 추가 후 Redeploy

`OPENAI_API_KEY`가 있으면 그쪽을 우선 쓰고, 없거나 실패하면 자동으로 무료 Pollinations로 대체돼요 (`app/api/illustrate/route.js` 참고). Pollinations는 무료인 대신 요청 간격 제한(약 15초당 1회)이 있고 상업적 안정성 보장은 없어요 — 개인 프로젝트로는 충분해요.

## 6. 무료 스톡 사진을 실제로 키워드에 맞게 바꾸기

1. https://unsplash.com/join 에서 계정 생성
2. https://unsplash.com/developers → "New Application" 으로 앱 등록 (무료, 심사 없이 바로 개발용 키 발급)
3. Access Key 복사 → Vercel 환경변수에 `UNSPLASH_ACCESS_KEY` 추가 후 Redeploy

키가 없으면 무작위 예시 이미지(키워드 무관)가 나오고, 키를 넣으면 카드 제목과 관련된 실제 사진을 Unsplash에서 검색해서 보여줘요. 개발용 키는 시간당 50회 제한이 있어요 (넘으면 자동으로 예시 이미지로 대체됩니다).

## 7. 카드 문구를 AI로 자연스럽게 다듬기

네이버가 주는 요약문은 가끔 라디오 대담 요약처럼 대화체거나("◎ 진행자 &gt; 그래요.") 문장 중간에서 잘려있어요. 정규식으로 문장을 나누는 방식은 이런 경우에 어색해질 수밖에 없어서, Claude(Anthropic) API로 자연스럽게 다듬는 옵션을 추가했어요.

1. https://console.anthropic.com 에서 가입 (무료 가입, API 사용은 사용량만큼 과금 — 이 정도 텍스트 요약은 건당 매우 저렴해요, 1건당 1원 미만 수준)
2. **API Keys** 메뉴에서 새 키 발급
3. Vercel 환경변수에 `ANTHROPIC_API_KEY` 추가 후 Redeploy

키를 넣으면 카드뉴스 편집 화면을 열 때마다 자동으로 한 번 호출돼서(기사당 1회) 요약문과 포인트를 자연스럽게 다듬어줘요. 키가 없으면 지금처럼 문장 단위로 자동 분리하는 방식이 그대로 쓰여요. 뉴스 소스에서만 동작하고(유튜브·구글은 이미 자체 요약이 짧아서 대상 아님), 실패하면 조용히 기존 방식으로 대체돼요.

이 기능은 이미지 생성과는 무관해요 — Claude는 텍스트만 다루고 이미지를 생성하지 않아요. 이미지가 필요하면 5번(AI 일러스트)이나 6번(스톡 사진) 섹션을 참고하세요.

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


