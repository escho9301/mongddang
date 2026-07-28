// 몽땅식탁 인스타그램의 최신 게시물 4개를 Instagram Graph API에서 가져와
// index.html 의 <!-- IG:START --> ~ <!-- IG:END --> 구간과 img/ig-1~4.jpg 를 갱신한다.
// 의존성 없음(Node 18+ 내장 fetch 사용). GitHub Actions에서 주기적으로 실행됨.
//
//   IG_TOKEN=<장기 액세스 토큰> node scripts/fetch-instagram.mjs
//
// 유튜브(fetch-youtube.mjs)와 달리 두 가지 제약이 있다:
//   1. 공개 RSS가 없어 액세스 토큰이 필수다. 2024-12-04 Basic Display API가 종료돼
//      지금은 "Instagram API with Instagram Login"(비즈니스/크리에이터 계정)만 쓸 수 있다.
//   2. API가 주는 media_url 은 서명된 임시 CDN 주소라 며칠 뒤 만료된다.
//      → 유튜브 썸네일처럼 주소를 박아둘 수 없어 이미지를 내려받아 저장소에 커밋한다.
//
// 토큰이 없거나 API가 실패하면 아무것도 건드리지 않고 종료한다(=현재 카드 유지).
// 사이트가 깨지는 일은 없고, 갱신만 멈춘다.

import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.IG_TOKEN;
const COUNT = 4; // .insta-grid 는 4칸(데스크톱)
const CAP_MAX = 80; // CSS가 2줄로 한번 더 자르므로 넉넉히 둔다
const API = process.env.IG_API_BASE || "https://graph.instagram.com"; // 버전 미지정 = 최신
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";

const HTML_FILE = new URL("../index.html", import.meta.url);
const IMG_DIR = new URL("../img/", import.meta.url);
const START = "<!-- IG:START (자동 생성 — .github/workflows/instagram.yml / scripts/fetch-instagram.mjs) -->";
const END = "<!-- IG:END -->";
const IND = " ".repeat(24); // insta-grid 내부 들여쓰기

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const htmlEsc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attrEsc = (s) => htmlEsc(s).replace(/"/g, "&quot;");

// 인스타 timestamp 는 +0000(UTC) → 한국 기준 날짜로 표기해야 새벽 게시물이 하루 밀리지 않는다
function fmtDate(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

function caption(raw) {
  if (!raw) return "";
  const flat = raw.replace(/\s+/g, " ").trim();
  // 본문 끝에 해시태그를 몰아 다는 국내 관행 → 꼬리 해시태그 덩어리만 걷어낸다.
  // (문장 중간에 섞인 해시태그는 본문의 일부이므로 그대로 둔다)
  let s = flat.replace(/(?:\s*#[^\s#]+)+$/u, "").trim();
  if (!s) s = flat; // 캡션이 해시태그뿐이면 원문 유지
  return s.length > CAP_MAX ? s.slice(0, CAP_MAX).trim() + "…" : s;
}

async function api(path, params) {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);
  const res = await fetch(url, { headers: { "User-Agent": "mongddang-site-bot/1.0" } });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// 이미지 주소 고르기: 영상/릴스는 썸네일, 캐러셀은 media_url 이 빠질 수 있어 첫 장을 따로 조회
async function pickImage(m) {
  if (m.media_type === "VIDEO") return m.thumbnail_url || m.media_url;
  if (m.media_url) return m.media_url;
  if (m.media_type === "CAROUSEL_ALBUM") {
    const kids = await api(`/${m.id}/children`, { fields: "media_url,thumbnail_url,media_type" });
    const first = kids?.data?.[0];
    return first?.media_type === "VIDEO" ? first.thumbnail_url : first?.media_url;
  }
  return null;
}

function card(p, i) {
  const file = `img/ig-${i + 1}.jpg`;
  const cap = caption(p.caption);
  // 파일명이 고정이라 내용이 바뀌어도 브라우저가 옛 이미지를 쓸 수 있다 → 게시물 id로 캐시 무효화
  const v = p.id.slice(-8);
  const alt = attrEsc(cap || "몽땅식탁 인스타그램 게시물");
  return [
    `${IND}<a class="insta-card" href="${attrEsc(p.permalink)}" target="_blank" rel="noopener" data-ig="${attrEsc(p.id)}">`,
    `${IND}    <div class="thumb"><img src="${file}?v=${v}" alt="${alt}" loading="lazy"></div>`,
    `${IND}    <p class="date">${fmtDate(p.timestamp)}</p>`,
    `${IND}    <p class="cap">${htmlEsc(cap)}</p>`,
    `${IND}</a>`,
  ].join("\n");
}

async function main() {
  if (!TOKEN) {
    console.error("IG_TOKEN 환경변수가 없음 — 변경 없이 종료 (리포 Secrets에 IG_TOKEN 등록 필요)");
    return;
  }

  let media;
  try {
    // 영상·캐러셀 중 이미지가 없는 건이 섞일 수 있어 넉넉히 받아 앞에서부터 COUNT개를 채운다
    const json = await api("/me/media", { fields: FIELDS, limit: "12" });
    media = json?.data || [];
  } catch (e) {
    console.error("인스타 API 요청 실패 — 변경 없이 종료:", e.message);
    console.error("   토큰 만료(60일)일 수 있음 → instagram-token.yml 워크플로 확인");
    return;
  }

  const posts = [];
  for (const m of media) {
    if (posts.length >= COUNT) break;
    let src;
    try {
      src = await pickImage(m);
    } catch (e) {
      console.error(`  ${m.id} 이미지 주소 조회 실패(건너뜀):`, e.message);
      continue;
    }
    if (src) posts.push({ ...m, src });
  }

  if (posts.length < COUNT) {
    console.error(`게시물 수 부족(${posts.length}/${COUNT}) — 변경 없이 종료`);
    return;
  }

  const html = await readFile(HTML_FILE, "utf8");
  const re = new RegExp(reEsc(START) + "[\\s\\S]*?" + reEsc(END));
  if (!re.test(html)) {
    console.error("index.html 에서 IG 마커를 찾지 못함 — 변경 없이 종료");
    return;
  }

  const block = `${START}\n${posts.map(card).join("\n")}\n${IND}${END}`;
  const updated = html.replace(re, block);
  if (updated === html) {
    console.log("최신 게시물 변경 없음 — 이미지 내려받기 생략");
    return;
  }

  // HTML이 실제로 바뀔 때만 이미지를 받는다(=6시간마다 같은 사진을 다시 커밋하지 않도록)
  for (let i = 0; i < posts.length; i++) {
    const res = await fetch(posts[i].src);
    if (!res.ok) {
      console.error(`이미지 다운로드 실패(HTTP ${res.status}) — 변경 없이 종료`);
      return; // 일부만 반영되면 카드와 사진이 어긋나므로 통째로 포기
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(new URL(`ig-${i + 1}.jpg`, IMG_DIR), buf);
  }

  await writeFile(HTML_FILE, updated);
  console.log("index.html 인스타 카드 갱신 완료:", posts.map((p) => p.permalink).join(" / "));
}

main();
