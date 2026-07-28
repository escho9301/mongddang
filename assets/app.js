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
        var track = marquee.querySelector(".partner-track");
        if (!track) return;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        var groupHTML = track.innerHTML;

        function build() {
            track.classList.remove("is-rolling");
            track.style.removeProperty("--marquee-dur");
            track.innerHTML = groupHTML;
            requestAnimationFrame(function () {
                var groupWidth = track.scrollWidth;
                if (!groupWidth) return;
                var need = marquee.clientWidth || groupWidth;
                var content = groupHTML, contentWidth = groupWidth, guard = 0;
                while (contentWidth < need && guard < 20) { content += groupHTML; contentWidth += groupWidth; guard++; }
                track.innerHTML = content + content;
                track.style.setProperty("--marquee-dur", Math.max(12, Math.round(contentWidth / 60)) + "s");
                track.classList.add("is-rolling");
            });
        }

        function whenImagesReady(cb) {
            var imgs = Array.prototype.slice.call(track.querySelectorAll("img"));
            var remaining = imgs.filter(function (im) { return !(im.complete && im.naturalWidth); });
            if (!remaining.length) { cb(); return; }
            var left = remaining.length, done = false;
            function one() { if (done) return; if (--left <= 0) { done = true; cb(); } }
            remaining.forEach(function (im) { im.addEventListener("load", one); im.addEventListener("error", one); });
            setTimeout(function () { if (!done) { done = true; cb(); } }, 3000);
        }

        whenImagesReady(build);

        var t;
        window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(build, 200); });
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
    var modal = null, panel = null, body = null, titleEl = null, newTab = null;
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
                '<a class="doc-modal-newtab" target="_blank" rel="noopener">새 탭에서 보기</a>' +
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
        newTab = modal.querySelector(".doc-modal-newtab");

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
        newTab.href = url;
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
        /* 새 탭/새 창으로 열려는 클릭은 그대로 둔다 */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        open(a.href);
    });
})();
