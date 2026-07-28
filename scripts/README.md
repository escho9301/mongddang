# 홈 "몽땅식탁 이야기" 섹션 자동 갱신

`index.html` 의 ARCHIVE 섹션(인스타 4칸 + 유튜브 2칸)을 GitHub Actions가 주기적으로 갱신한다.
각 스크립트는 HTML 안의 주석 마커 구간만 통째로 바꿔치기한다.

| | 마커 | 스크립트 | 워크플로 | 토큰 |
|---|---|---|---|---|
| 유튜브 | `<!-- YT:START -->` ~ `<!-- YT:END -->` | `fetch-youtube.mjs` | `youtube.yml` | **불필요** (공개 RSS) |
| 인스타 | `<!-- IG:START -->` ~ `<!-- IG:END -->` | `fetch-instagram.mjs` | `instagram.yml` + `instagram-token.yml` | **필요** |

두 스크립트 모두 **실패하면 아무것도 건드리지 않고 종료**한다. API가 죽거나 토큰이 만료돼도
사이트가 깨지지 않고 갱신만 멈춘다.

---

## 인스타그램 최초 설정 (한 번만)

유튜브와 달리 인스타는 공개 RSS가 없어 액세스 토큰이 필요하다.
2024-12-04 Basic Display API가 폐지돼, 지금은 **Instagram API with Instagram Login** 만 쓸 수 있다.

### 1. 인스타 계정을 프로페셔널로 전환

개인 계정으로는 API를 못 쓴다. 인스타 앱 → 설정 → 계정 유형 → **비즈니스 또는 크리에이터**.
무료이고 30초면 되며, 공개 프로필 모양은 거의 그대로다.

### 2. Meta 개발자 앱 만들기

[developers.facebook.com](https://developers.facebook.com) → **내 앱 → 앱 만들기**

- 사용 사례에서 **Instagram** 관련 항목을 고른다
- 제품에 **Instagram** 추가 → **API 설정(Instagram 로그인 사용)**
- 권한(스코프)에 `instagram_business_basic` 이 포함돼야 한다 — 게시물 읽기에 필요한 최소 권한

> 콘솔 UI 문구는 자주 바뀐다. "Instagram 로그인", "비즈니스 로그인 설정", "토큰 생성"
> 이 세 단어를 랜드마크로 찾으면 된다.

### 3. 장기(60일) 액세스 토큰 발급

같은 화면의 **토큰 생성기**에서 위 인스타 계정을 연결하고 토큰을 만든다.
발급된 토큰이 잘 되는지 먼저 확인:

```bash
curl -s "https://graph.instagram.com/me/media?fields=id,permalink&limit=1&access_token=<토큰>"
```

게시물 하나가 JSON으로 돌아오면 성공이다. `error` 가 뜨면 계정 유형이나 권한을 다시 확인한다.

### 4. GitHub 시크릿 2개 등록

리포 **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `IG_TOKEN` | 3번에서 받은 장기 토큰 |
| `IG_SECRET_PAT` | GitHub PAT (Fine-grained, 이 리포에 **Secrets: Read and write** 권한) |

`IG_SECRET_PAT` 이 필요한 이유: 토큰은 60일이면 만료되므로 `instagram-token.yml` 이 매주
새 토큰으로 `IG_TOKEN` 을 덮어써야 하는데, 기본 `GITHUB_TOKEN` 으로는 시크릿을 쓸 수 없다.

### 5. 워크플로 푸시 후 첫 실행

`.github/` 가 `main` 에 올라가야 Actions가 인식한다. 푸시한 뒤:

**Actions 탭 → "홈 인스타그램 최신 게시물 자동 갱신" → Run workflow** 로 수동 실행해 본다.
성공하면 `index.html` 과 `img/ig-1~4.jpg` 를 갱신하는 커밋이 봇 이름으로 하나 올라온다.

### 6. 자리잡은 뒤 옛 이미지 정리

첫 실행이 성공하면 HTML이 `img/ig-N.jpg` 를 가리키므로 placeholder였던
`img/ig-1~4.png` 는 더 이상 쓰이지 않는다. 확인 후 지우면 된다.

```bash
git rm img/ig-1.png img/ig-2.png img/ig-3.png img/ig-4.png
```

---

## 동작 방식 메모

- **이미지를 저장소에 받아둔다.** 인스타 `media_url` 은 서명된 임시 CDN 주소라 며칠이면 만료된다.
  유튜브 썸네일(`i.ytimg.com/vi/{id}/...`)처럼 주소를 박아둘 수 없다.
- **HTML이 바뀔 때만 이미지를 내려받는다.** 6시간마다 같은 사진을 다시 커밋하면 저장소가 계속 커진다.
- **워크플로가 800px로 줄여 커밋한다.** 카드 표시 폭이 ~330px이라 2x 디스플레이에도 충분하다.
- **캡션은 원문을 쓰되** 공백을 정리하고, 본문 끝에 몰아 단 해시태그 덩어리를 걷어낸 뒤 80자에서 자른다.
  (문장 중간의 해시태그는 본문의 일부라 남긴다. 캡션이 해시태그뿐이면 원문 그대로 둔다.)
  카드 CSS에 `-webkit-line-clamp: 2` 가 걸려 있어 화면에서는 2줄로 한 번 더 잘린다.
- **날짜는 KST 기준**이다. API가 주는 `timestamp` 는 UTC라 그대로 쓰면 새벽 게시물이 하루 밀린다.
- 영상·릴스는 `thumbnail_url`, 캐러셀은 `/{id}/children` 의 첫 장을 쓴다.
  넷 중 어느 것도 없으면 그 게시물은 건너뛰고 다음 게시물로 채운다.

## 문제 해결

| 증상 | 원인 / 조치 |
|---|---|
| `IG_TOKEN 환경변수가 없음` | 시크릿 미등록. 4번 단계 확인 |
| `인스타 API 요청 실패` | 토큰 만료 또는 권한 부족. `instagram-token.yml` 실행 기록 확인 |
| 토큰 갱신 잡이 실패 | 60일을 넘겨 완전히 만료된 경우. 2~3번을 다시 밟아 새 토큰 발급 후 `IG_TOKEN` 교체 |
| `게시물 수 부족` | 인스타에 이미지 게시물이 4개 미만 |
| `IG 마커를 찾지 못함` | `index.html` 편집 중 `<!-- IG:START/END -->` 주석이 지워짐 |

## 로컬에서 실행

```bash
IG_TOKEN=<토큰> node scripts/fetch-instagram.mjs
```
