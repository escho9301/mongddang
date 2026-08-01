/* 몽땅식탁 공통 스크립트 */
(function () {
    "use strict";

    /* ---------- 모바일 네비게이션 토글 ---------- */
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.querySelector(".nav-menu");
    if (toggle && menu) {
        toggle.addEventListener("click", function () {
            var open = menu.classList.toggle("open");
            toggle.classList.toggle("open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
        menu.addEventListener("click", function (e) {
            // 실제 페이지 이동 링크 클릭 시 모바일 메뉴 닫기
            var a = e.target.closest("a");
            if (a && a.getAttribute("href")) {
                menu.classList.remove("open");
                toggle.classList.remove("open");
                toggle.setAttribute("aria-expanded", "false");
            }
        });
    }

    /* ---------- 홈 히어로 이미지 롤링(캐러셀) ---------- */
    (function () {
        var carousel = document.querySelector(".hero-carousel");
        if (!carousel) return;
        var slides = Array.prototype.slice.call(carousel.querySelectorAll(".hero-slide"));
        if (slides.length < 2) return;

        var dotsWrap = carousel.querySelector(".hero-dots");
        var dots = [];
        var idx = 0, timer = null;
        var DELAY = 3000;
        var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function show(n) {
            slides[idx].classList.remove("is-active");
            if (dots[idx]) dots[idx].classList.remove("is-active");
            idx = (n + slides.length) % slides.length;
            slides[idx].classList.add("is-active");
            if (dots[idx]) dots[idx].classList.add("is-active");
        }
        function nextSlide() { show(idx + 1); }
        function start() { if (!reduce && !timer) timer = setInterval(nextSlide, DELAY); }
        function stop() { if (timer) { clearInterval(timer); timer = null; } }

        if (dotsWrap) {
            slides.forEach(function (_, i) {
                var b = document.createElement("button");
                b.type = "button";
                b.className = "hero-dot" + (i === 0 ? " is-active" : "");
                b.setAttribute("aria-label", (i + 1) + "번 이미지 보기");
                b.addEventListener("click", function () { stop(); show(i); start(); });
                dotsWrap.appendChild(b);
                dots.push(b);
            });
        }

        carousel.addEventListener("mouseenter", stop);
        carousel.addEventListener("mouseleave", start);
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) { stop(); } else { start(); }
        });

        start();
    })();

    /* ---------- 주요 파트너 로고 롤링(마퀴) ---------- */
    (function () {
        var marquee = document.querySelector(".partner-marquee");
        if (!marquee) return;
        var seed = marquee.querySelector(".partner-track");
        if (!seed) return;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        /* 로고 한 벌을 문자열로 떠 둔다. 다시 깔 때 loading="lazy" 는 떼어 낸다 —
           마퀴는 로고가 화면에 들어온 뒤에 만들기 시작하므로 미룰 이유가 없고,
           lazy 인 채로 새로 만들면 사용자가 이미 지나쳐 버린 경우 끝내 로드되지 않아
           폭이 0 으로 남고 마퀴가 영영 시작되지 않는다. */
        var logos = Array.prototype.map.call(seed.children, function (el) {
            return el.outerHTML.replace(/\sloading="lazy"/g, "");
        });

        /* 폭을 재도 되는 시점인지 확인한다.
           (1) 로고는 loading="lazy" 이고 첫 화면 아래에 있어 로드 전에는 폭이 0 이다.
           (2) innerHTML 로 다시 깔면 img 노드가 새로 생겨, 캐시에 있어도 폭이 한 박자 늦게 잡힌다.
           둘 다 "재는 시점" 문제라 항상 이 안에서 재도록 감싼다. */
        function whenReady(row, cb) {
            var imgs = Array.prototype.slice.call(row.querySelectorAll("img"));
            var pending = imgs.filter(function (im) { return !(im.complete && im.naturalWidth); });
            if (!pending.length) { cb(); return; }
            var left = pending.length, done = false;
            function one() { if (done) return; if (--left <= 0) { done = true; cb(); } }
            pending.forEach(function (im) { im.addEventListener("load", one); im.addEventListener("error", one); });
            setTimeout(function () { if (!done) { done = true; cb(); } }, 5000);
        }

        /* Figma 는 데스크톱(3382:10851)은 한 줄, 모바일(3414:9862)은 4개 + 3개 두 줄로 나눈다.
           마크업 순서가 곧 Figma 의 줄 순서라 앞 4개 / 뒤 3개로 자르면 그대로 맞는다. */
        function build() {
            var rows = (window.innerWidth <= 760) ? [logos.slice(0, 4), logos.slice(4)] : [logos];
            marquee.innerHTML = "";
            rows.forEach(function (logoSet, i) {
                var html = logoSet.join("");
                var row = document.createElement("div");
                /* 두 줄일 때 아랫줄은 반대로 흘려보낸다 — 같은 방향이면 두 줄이 한 덩어리로 보인다 */
                row.className = "partner-track" + (i ? " is-reverse" : "");
                row.innerHTML = html;
                marquee.appendChild(row);
                whenReady(row, function () { roll(row, html); });
            });
        }

        function roll(track, groupHTML) {
            /* 폭은 "굴러갈 때의 배치"(한 줄)에서 재야 한다. 평소 배치는 flex-wrap:wrap 이라
               scrollWidth 가 한 줄 총폭이 아니라 컨테이너 폭(=화면 폭)으로 잡히고,
               그러면 복제 개수와 속도가 함께 어긋난다.
               is-rolling 을 미리 붙이면 애니메이션이 먼저 도니 인라인 스타일로만 잠깐 바꾼다.
               scrollWidth 를 읽는 순간 레이아웃이 강제로 계산되므로 rAF 는 필요 없다 —
               rAF 에 맡기면 배경 탭처럼 스로틀되는 상황에서 마퀴가 아예 시작되지 않는다. */
            track.style.flexWrap = "nowrap";
            track.style.width = "max-content";
            var groupWidth = track.scrollWidth;
            track.style.flexWrap = "";
            track.style.width = "";
            if (!groupWidth) return;

            /* 한 세트가 화면보다 좁으면 이어 붙여 화면을 채운다. 그래야 이음매에 빈 공간이 안 생긴다. */
            var need = marquee.clientWidth || groupWidth;
            var copies = 1, contentWidth = groupWidth;
            while (contentWidth < need && copies < 20) { copies++; contentWidth += groupWidth; }

            /* 같은 내용을 두 벌 깔고 정확히 한 벌만큼(-50%) 밀면 끊김 없이 이어진다.
               이미 폭이 잡힌 첫 세트는 건드리지 않고 뒤에만 덧붙인다 —
               통째로 다시 그리면 방금 잰 폭이 또 0 으로 돌아간다. */
            var extra = "";
            for (var i = 1; i < copies * 2; i++) extra += groupHTML;
            track.insertAdjacentHTML("beforeend", extra);
            track.style.setProperty("--marquee-dur", Math.max(12, Math.round(contentWidth / 60)) + "s");
            track.classList.add("is-rolling");
        }

        if (window.IntersectionObserver) {
            var io = new IntersectionObserver(function (entries) {
                if (!entries.some(function (en) { return en.isIntersecting; })) return;
                io.disconnect();
                build();
            }, { rootMargin: "200px" });   /* 조금 못 미쳐도 미리 준비 */
            io.observe(marquee);
        } else {
            build();
        }

        var t;
        window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(build, 200); });
    })();

    /* ---------- 오프라인 "지역 동아리" 사진 3장 롤링 ----------
       Figma 모바일은 253.5 카드를 가운데 세우고 양옆 장이 걸쳐 보이게 둔다 = 캐러셀.
       데스크톱은 셋이 한 줄에 다 보이므로 넘길 것이 없다. */
    (function () {
        var track = document.querySelector(".comm-trio");
        if (!track) return;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        var cards = Array.prototype.slice.call(track.querySelectorAll("figure"));
        if (cards.length < 2) return;

        var holdUntil = 0;

        /* 가로로 넘칠 때(=모바일)만 돈다 */
        function scrollable() { return track.scrollWidth - track.clientWidth > 4; }

        /* offsetLeft 는 트랙이 아니라 "위치 지정된 조상" 기준이라 트랙이 static 이면 어긋난다.
           어긋난 목표는 스냅 지점이 아니어서 브라우저가 도로 제자리로 당겨 버린다.
           트랙 기준 좌표로 직접 재서 정확한 스냅 지점을 넘긴다. */
        function centerOf(card) {
            var d = card.getBoundingClientRect().left - track.getBoundingClientRect().left;
            return track.scrollLeft + d + card.offsetWidth / 2 - track.clientWidth / 2;
        }

        function current() {
            var best = 0, min = Infinity;
            cards.forEach(function (c, i) {
                var d = Math.abs(centerOf(c) - track.scrollLeft);
                if (d < min) { min = d; best = i; }
            });
            return best;
        }

        var restore = null;
        function tick() {
            if (!scrollable() || document.hidden || Date.now() < holdUntil) return;
            var to = (current() + 1) % cards.length;
            /* mandatory 스냅이 걸린 채로 프로그램에서 굴리면 브라우저가 스냅 지점으로
               도로 당겨 버려 제자리에 머무는 일이 있다. 굴리는 동안만 스냅을 꺼 둔다.
               (손으로 넘길 때는 스냅이 있어야 한 장씩 딱 선다) */
            track.style.scrollSnapType = "none";
            /* 마지막에서 첫 장으로 갈 때는 길게 되감지 않고 바로 붙인다 */
            track.scrollTo({ left: centerOf(cards[to]), behavior: to === 0 ? "auto" : "smooth" });
            clearTimeout(restore);
            restore = setTimeout(function () { track.style.scrollSnapType = ""; }, 800);
        }

        /* 손이 닿으면 잠시 멈춘다 — 직접 넘기는 중에 끼어들면 성가시다 */
        function hold() { holdUntil = Date.now() + 6000; }
        ["pointerdown", "touchstart", "wheel"].forEach(function (ev) {
            track.addEventListener(ev, hold, { passive: true });
        });

        setInterval(tick, 3500);
    })();

    /* ---------- 문의·협업 폼 (Web3Forms) ---------- */
    var form = document.getElementById("contactForm");
    if (!form) return;

    var result = document.getElementById("formResult");
    var submitBtn = document.getElementById("cfSubmit");
    var submitLabel = submitBtn ? submitBtn.textContent : "문의 하기";

    var CONTACT_EMAIL = "mongddangsigtag@gmail.com";

    function showResult(type, msg) {
        result.className = "cf-result show " + type;
        result.textContent = msg;   /* 이전에 붙인 대체 링크도 함께 지워진다 */
    }

    /* 전송이 실패했을 때(월 한도 초과·서비스 장애·네트워크 오류) 안내만 하면
       사용자가 작성한 내용을 처음부터 다시 써야 한다. 입력값을 그대로 담은
       메일 링크를 함께 띄워, 클릭 한 번으로 메일 앱에서 보낼 수 있게 한다.
       폼은 초기화하지 않으므로 새로고침만 안 하면 내용도 남아 있다. */
    function showFallback(msg) {
        showResult("err", msg);

        var d = new FormData(form);
        var val = function (k) { return (d.get(k) || "").toString().trim(); };
        var msgText = val("message");
        /* 일부 메일 클라이언트가 긴 mailto 주소를 잘라버려 본문이 통째로 날아간다 */
        if (msgText.length > 1200) msgText = msgText.slice(0, 1200) + "\n…(이하 생략 — 메일에서 이어서 작성해 주세요)";

        var body = [
            "기관/회사명: " + val("company"),
            "담당자 성함: " + val("name"),
            "이메일: " + val("email"),
            "연락처: " + (val("phone") || "-"),
            "",
            "문의 내용:",
            msgText
        ].join("\n");

        var a = document.createElement("a");
        a.className = "cf-fallback";
        a.href = "mailto:" + CONTACT_EMAIL +
            "?subject=" + encodeURIComponent("[몽땅식탁] 문의·협업 요청") +
            "&body=" + encodeURIComponent(body);
        a.textContent = "메일로 바로 보내기 — 작성하신 내용이 그대로 채워집니다";

        result.appendChild(document.createElement("br"));
        result.appendChild(a);
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var accessKey = form.querySelector('[name="access_key"]').value;
        if (!accessKey || accessKey === "YOUR_ACCESS_KEY_HERE") {
            /* 키가 비거나 되돌려진 배포 사고. 방문자에게 개발 용어를 보여줄 이유가 없으므로
               콘솔로만 알리고, 화면에는 메일 대안을 준다. */
            console.error("[문의 폼] Web3Forms access_key 가 설정되지 않았습니다.");
            showFallback("지금은 문의를 접수할 수 없습니다. 아래 링크로 메일을 보내주세요.");
            return;
        }

        var data = Object.fromEntries(new FormData(form).entries());

        submitBtn.disabled = true;
        submitBtn.textContent = "보내는 중…";
        result.className = "cf-result";

        fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(data)
        })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
            if (r.ok && r.j.success) {
                form.reset();
                showResult("ok", "문의가 정상적으로 접수되었습니다. 영업일 기준 2~3일 내에 담당자가 연락드리겠습니다. 감사합니다!");
            } else {
                /* 한도 초과·차단 등 서버가 거절한 경우. 응답 메시지는 영문이라 그대로 노출하지 않고
                   콘솔에만 남기고, 사용자에게는 바로 대안을 준다. */
                if (r.j && r.j.message) console.warn("[문의 폼] Web3Forms 거절:", r.j.message);
                showFallback("지금은 문의를 접수할 수 없습니다. 아래 링크로 메일을 보내주시면 동일하게 처리됩니다.");
            }
        })
        .catch(function () {
            showFallback("네트워크 오류로 전송하지 못했습니다. 아래 링크로 메일을 보내주세요.");
        })
        .finally(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = submitLabel;
        });
    });
})();

/* ==========================================================================
   법적 문서 팝업 (웹사이트 전용)
   - terms/privacy.html 원본 파일은 그대로 둔다. 앱 스토어 심사와 앱 웹뷰가
     그 URL을 직접 참조하므로 반드시 단독 페이지로 계속 열려야 한다.
   - 여기서는 사이트 안의 링크만 가로채, 같은 문서를 fetch 해 팝업으로 띄운다.
   - JS 실패 / fetch 실패 / 새 탭 클릭(⌘·Ctrl·중클릭)은 원래대로 페이지 이동.
   ========================================================================== */
(function () {
    var TARGET = /terms\/privacy\.html$/;   /* 팝업으로 띄울 문서 */
    var modal = null, panel = null, body = null, titleEl = null;
    var lastFocus = null, cache = {};

    function build() {
        modal = document.createElement("div");
        modal.className = "doc-modal";
        modal.hidden = true;
        modal.innerHTML =
            '<div class="doc-modal-backdrop" data-close></div>' +
            '<div class="doc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="doc-modal-title">' +
              '<div class="doc-modal-head">' +
                '<h2 id="doc-modal-title">개인정보 처리방침</h2>' +
                '<button type="button" class="doc-modal-close" data-close aria-label="닫기">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
                '</button>' +
              '</div>' +
              '<div class="doc-modal-body" tabindex="-1"></div>' +
            '</div>';
        document.body.appendChild(modal);
        panel = modal.querySelector(".doc-modal-panel");
        body = modal.querySelector(".doc-modal-body");
        titleEl = modal.querySelector("#doc-modal-title");

        modal.addEventListener("click", function (e) {
            if (e.target.closest("[data-close]")) close();
        });
        document.addEventListener("keydown", function (e) {
            if (modal.hidden) return;
            if (e.key === "Escape") { close(); return; }
            if (e.key === "Tab") trapFocus(e);
        });
    }

    /* 모달 안에서만 Tab 순환 */
    function trapFocus(e) {
        var f = panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function open(url) {
        if (!modal) build();
        lastFocus = document.activeElement;
        body.innerHTML = '<p class="doc-modal-status">문서를 불러오는 중…</p>';

        /* 스크롤바 폭만큼 보정해 배경이 밀리지 않게 */
        var sb = window.innerWidth - document.documentElement.clientWidth;
        if (sb > 0) document.body.style.paddingRight = sb + "px";
        document.body.classList.add("doc-modal-open");

        modal.hidden = false;
        void modal.offsetWidth;   /* 초기 상태를 강제 반영한 뒤 전환 — rAF가 스로틀돼도 확실히 보이게 */
        modal.classList.add("is-open");
        body.focus();

        load(url);
    }

    function load(url) {
        if (cache[url]) { render(cache[url]); return; }
        /* no-cache: 법적 문서이므로 매번 서버와 재검증해 옛 방침이 캐시로 남아 보이지 않게 한다 */
        fetch(url, { cache: "no-cache" })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
            .then(function (html) {
                var doc = new DOMParser().parseFromString(html, "text/html");
                var main = doc.querySelector("main.doc-wrap");
                if (!main) throw new Error("content not found");

                /* 제목은 모달 헤더로 옮기고 본문에서는 제거 */
                var h1 = main.querySelector("h1");
                var heading = h1 ? h1.textContent.trim() : "개인정보 처리방침";
                if (h1) h1.remove();

                /* 문서 기준 상대경로를 절대경로로 바꿔 링크가 깨지지 않게 */
                main.querySelectorAll("a[href]").forEach(function (a) {
                    try { a.href = new URL(a.getAttribute("href"), url).href; } catch (err) {}
                    if (/^https?:/i.test(a.href) && a.host !== location.host) {
                        a.target = "_blank"; a.rel = "noopener";
                    }
                });
                main.querySelectorAll("img[src]").forEach(function (img) {
                    try { img.src = new URL(img.getAttribute("src"), url).href; } catch (err) {}
                });

                cache[url] = { heading: heading, html: main.innerHTML };
                render(cache[url]);
            })
            .catch(function () {
                /* 불러오지 못하면 원래 페이지로 이동 — 문서를 못 보는 상황은 만들지 않는다 */
                window.location.href = url;
            });
    }

    function render(data) {
        titleEl.textContent = data.heading;
        body.innerHTML = data.html;
        body.scrollTop = 0;
    }

    function close() {
        if (!modal || modal.hidden) return;
        modal.classList.remove("is-open");
        var done = function () {
            modal.hidden = true;
            document.body.classList.remove("doc-modal-open");
            document.body.style.paddingRight = "";
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        };
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) done(); else setTimeout(done, 200);
    }

    document.addEventListener("click", function (e) {
        var a = e.target.closest("a[href]");
        if (!a) return;
        if (!TARGET.test(a.getAttribute("href") || "")) return;
        /* 모달 자신의 "새 탭에서 보기" 링크만 가로채지 않는다.
           그 링크도 같은 문서를 가리켜서, 막지 않으면 여기서 preventDefault 되어
           새 탭이 안 열리고 이미 열린 모달만 다시 열린다.
           target="_blank" 전체를 제외하면 안 된다 — 문의 폼의 동의 안내 링크처럼
           본문에도 target="_blank" 인 링크가 있고, 그건 팝업으로 떠야 한다. */
        if (modal && modal.contains(a)) return;
        /* 새 탭/새 창으로 열려는 클릭은 그대로 둔다 */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        open(a.href);
    });
})();

/* ==========================================================================
   유튜브 카드 자리 재생
   - 카드를 누르면 유튜브로 나가지 않고 썸네일 자리에 플레이어를 끼워 넣는다.
   - 처음부터 iframe 을 깔면 영상 수만큼 유튜브 스크립트를 받아 첫 로딩이 느려지므로,
     실제로 누른 카드 하나만 바꾼다.
   - 마크업은 그대로 두고 여기서만 처리한다. fetch-youtube.mjs 가 만드는 카드 형태를
     건드리지 않으므로 자동 갱신과 충돌하지 않는다.
   - JS 가 없거나 주소 형태가 다르면 원래대로 유튜브로 이동한다(<a> 를 그대로 뒀다).
   ========================================================================== */
(function () {
    /* 한 번에 하나만 재생한다. 다른 영상을 틀면 앞의 것은 멈추고 썸네일로 되돌린다.
       iframe 을 그냥 두면 소리가 겹치고, 유튜브 플레이어도 계속 살아 있게 된다. */
    var playing = null;          /* 지금 재생 중인 카드 */
    var savedThumb = null;       /* 그 카드의 원래 썸네일 마크업 */

    function stopPlaying() {
        if (!playing) return;
        var t = playing.querySelector(".thumb");
        if (t && savedThumb !== null) {
            t.innerHTML = savedThumb;   /* iframe 제거 = 재생 중지. 썸네일이 다시 보인다 */
            t.classList.remove("is-playing");
        }
        playing = null;
        savedThumb = null;
    }

    document.addEventListener("click", function (e) {
        var card = e.target.closest ? e.target.closest(".yt-card") : null;
        if (!card) return;
        /* 새 탭으로 열려는 클릭은 유튜브로 보낸다 */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

        var id = (/[?&]v=([A-Za-z0-9_-]{6,})/.exec(card.getAttribute("href") || "") || [])[1];
        if (!id) return;

        var thumb = card.querySelector(".thumb");
        if (!thumb) return;
        /* 이미 이 카드가 재생 중이면 건드리지 않는다 — 일시정지 등은 유튜브 플레이어에 맡긴다 */
        if (thumb.querySelector("iframe")) return;

        e.preventDefault();
        stopPlaying();               /* 새로 틀기 전에 앞의 영상을 멈춘다 */

        var cap = card.querySelector(".cap");
        var frame = document.createElement("iframe");
        /* nocookie 도메인은 재생 전까지 추적 쿠키를 심지 않는다 */
        frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
        frame.title = cap ? cap.textContent : "몽땅식탁 영상";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "strict-origin-when-cross-origin";

        savedThumb = thumb.innerHTML;        /* 나중에 되돌릴 원본을 보관 */
        thumb.innerHTML = "";
        thumb.appendChild(frame);
        thumb.classList.add("is-playing");   /* 딤 오버레이를 걷는다 */
        playing = card;
    });
})();

/* 저작권 표기의 끝 연도를 올해로 맞춘다.
   기준 연도(2023)는 최초 발행 연도라 고정이고, 끝 연도만 매년 바뀐다.
   HTML 에 올해 값을 적어 뒀으므로 JS 가 없어도 표기가 비지 않는다. */
(function () {
    var y = String(new Date().getFullYear());
    Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (el) {
        if (el.textContent !== y) el.textContent = y;
    });
})();
