// 몽땅식탁 유튜브 채널의 최신 영상 2개를 RSS 피드에서 가져와
// index.html 의 <!-- YT:START --> ~ <!-- YT:END --> 구간을 자동 갱신한다.
// 의존성 없음(Node 18+ 내장 fetch 사용). GitHub Actions에서 주기적으로 실행됨.
//
//   node scripts/fetch-youtube.mjs
//
// 채널 변경 시: 환경변수 YT_CHANNEL_ID 로 덮어쓰거나 아래 기본값 수정.

import { readFile, writeFile } from "node:fs/promises";

const CHANNEL_ID = process.env.YT_CHANNEL_ID || "UC1zZ-o2dgAro0b_TANsDYgg"; // @몽땅식탁
const COUNT = 2;
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const HTML_FILE = new URL("../index.html", import.meta.url);
const START = "<!-- YT:START (자동 생성 — .github/workflows/youtube.yml / scripts/fetch-youtube.mjs) -->";
const END = "<!-- YT:END -->";
const IND = " ".repeat(24); // yt-grid 내부 들여쓰기

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const attrEsc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// RSS의 <title>은 XML 이스케이프 상태(&amp; 등) → 속성용으로는 한번 풀고 다시 안전하게 escape
const xmlDecode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

function fmtDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

function card(v) {
  const watch = `https://www.youtube.com/watch?v=${v.id}`;
  const max = `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`;
  const hq = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
  const titleAttr = attrEsc(xmlDecode(v.title)); // alt 속성용
  const titleText = v.title; // 텍스트 콘텐츠용(이미 XML=HTML 이스케이프 호환)
  return [
    `${IND}<a class="yt-card" href="${watch}" target="_blank" rel="noopener">`,
    `${IND}    <div class="thumb"><img src="${max}" alt="${titleAttr}" loading="lazy" onerror="this.onerror=null;this.src='${hq}'"><span class="play" aria-hidden="true"></span></div>`,
    `${IND}    <p class="date">${fmtDate(v.published)}</p>`,
    `${IND}    <p class="cap">${titleText}</p>`,
    `${IND}</a>`,
  ].join("\n");
}

async function main() {
  let xml;
  try {
    const res = await fetch(FEED, { headers: { "User-Agent": "mongddang-site-bot/1.0" } });
    if (!res.ok) {
      console.error(`RSS 요청 실패: HTTP ${res.status} — 변경 없이 종료`);
      return;
    }
    xml = await res.text();
  } catch (e) {
    console.error("RSS 요청 오류 — 변경 없이 종료:", e.message);
    return;
  }

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
  const vids = [];
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    if (id && title && published) vids.push({ id, title: title.trim(), published });
    if (vids.length >= COUNT) break;
  }

  if (vids.length < COUNT) {
    console.error(`영상 수 부족(${vids.length}/${COUNT}) — 변경 없이 종료`);
    return;
  }

  const block = `${START}\n${vids.map(card).join("\n")}\n${IND}${END}`;
  const html = await readFile(HTML_FILE, "utf8");
  const re = new RegExp(reEsc(START) + "[\\s\\S]*?" + reEsc(END));
  if (!re.test(html)) {
    console.error("index.html 에서 YT 마커를 찾지 못함 — 변경 없이 종료");
    return;
  }

  const updated = html.replace(re, block);
  if (updated === html) {
    console.log("최신 영상 변경 없음:", vids.map((v) => v.title).join(" / "));
    return;
  }
  await writeFile(HTML_FILE, updated);
  console.log("index.html 유튜브 카드 갱신 완료:", vids.map((v) => v.title).join(" / "));
}

main();
